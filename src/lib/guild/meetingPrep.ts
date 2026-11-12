import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { aiJson } from '@/lib/ai'
import { saveMeeting } from '@/lib/guild/meeting'
import { cleanPrep, KIND_LABELS, MEET_LEAD_MS, type Prep, type Segment } from '@/lib/meeting'

/**
 * Kers' prep for the meeting (docs/06-meeting-mode.md, Phase 1): for each
 * agenda segment, 2-3 talking points and one opener, drafted from the
 * segment's board posts (the post, its comments, its votes) before the
 * meeting. Never during it: the presenter screen only reads what's stored.
 *
 * "Who to ask" is worked out at the same time: the members who voted on or
 * commented on the segment's posts (ghost comments and system accounts left
 * out). It is stored with the prep and never sent to any client.
 *
 * Drafted when the agenda is locked (posted to Slack), by the day-before
 * cron, and at the latest when an admin's board loads inside the 3 h before
 * the meeting. Each pass only fills segments that have no prep yet, so an
 * admin's edits are never overwritten; the Run tab can redraft one segment.
 */

type StoredPrep = Prep & { ask: string[] }
type StoredSegment = Omit<Segment, 'prep'> & { prep?: (Prep & { ask?: string[] }) | null }

/** A failed draft is retried after this long (the next trigger that comes along). */
const RETRY_MS = 30 * 60_000
const ASK_MAX = 20

function needsPrep(s: StoredSegment, now: number): boolean {
  const p = s.prep
  if (!p) return true
  if (p.by === 'admin') return false
  const empty = !p.points?.length && !p.opener
  return empty && (!p.at || now - new Date(p.at).getTime() > RETRY_MS)
}

async function readAgenda(cycleId: string): Promise<StoredSegment[]> {
  const { data } = await createAdminClient().from('meetings').select('agenda').eq('cycle_id', cycleId).maybeSingle()
  return Array.isArray(data?.agenda) ? (data.agenda as StoredSegment[]) : []
}

interface PostFacts {
  title: string
  description: string
  votes: number
  comments: string[]
}

/** The posts behind the segments, and who voted or commented on each. */
async function gather(topicIds: string[]): Promise<{ posts: Map<string, PostFacts>; people: Map<string, Set<string>> }> {
  const posts = new Map<string, PostFacts>()
  const people = new Map<string, Set<string>>()
  if (!topicIds.length) return { posts, people }
  const admin = createAdminClient()
  const [{ data: topics }, { data: comments }, { data: votes }] = await Promise.all([
    admin.from('topics').select('id, title, description, vote_count').in('id', topicIds).eq('is_deleted', false),
    admin.from('comments').select('topic_id, user_id, body, is_anonymous').in('topic_id', topicIds).eq('is_deleted', false).order('created_at', { ascending: true }).limit(300),
    admin.from('votes').select('topic_id, user_id').in('topic_id', topicIds),
  ])
  for (const t of topics ?? []) posts.set(t.id, { title: t.title, description: t.description ?? '', votes: t.vote_count ?? 0, comments: [] })
  const add = (topicId: string, userId: string | null | undefined) => {
    if (!userId) return
    if (!people.has(topicId)) people.set(topicId, new Set())
    people.get(topicId)!.add(userId)
  }
  for (const c of comments ?? []) {
    const post = posts.get(c.topic_id)
    if (post && post.comments.length < 8) post.comments.push(String(c.body).replace(/https?:\/\/\S+/g, '').slice(0, 280))
    // A ghost stays a ghost, even here.
    if (!c.is_anonymous) add(c.topic_id, c.user_id)
  }
  for (const v of votes ?? []) add(v.topic_id, v.user_id)

  // System accounts (GuildBot) aren't anyone to ask.
  const everyone = [...new Set([...people.values()].flatMap(s => [...s]))]
  if (everyone.length) {
    const { data: system } = await admin.from('users').select('id').in('id', everyone).eq('is_system', true)
    for (const u of system ?? []) for (const set of people.values()) set.delete(u.id)
  }
  return { posts, people }
}

/**
 * Draft prep for the segments that need it (or just `segmentId`, redrafted
 * even over an edit). Stores the result, or an empty prep marking the
 * attempt when the model gave nothing, so the segment shows only its title
 * and detail and the next trigger retries after half an hour.
 */
export async function draftPrep(cycleId: string, opts: { segmentId?: string } = {}): Promise<{ drafted: number; tried: number }> {
  const now = Date.now()
  const agenda = await readAgenda(cycleId)
  const targets = agenda.filter(s => (opts.segmentId ? s.id === opts.segmentId : needsPrep(s, now)))
  if (!targets.length) return { drafted: 0, tried: 0 }

  const ids = [...new Set(targets.flatMap(s => (Array.isArray(s.topicIds) ? s.topicIds : [])))]
  const { posts, people } = await gather(ids)

  const facts = targets.map(s => ({
    id: s.id,
    kind: KIND_LABELS[s.kind] ?? 'Segment',
    title: s.title,
    detail: s.detail,
    minutes: s.minutes,
    posts: (s.topicIds ?? []).map(id => posts.get(id)).filter(Boolean),
  }))

  const result = await aiJson<{ segments?: { id?: unknown; points?: unknown; opener?: unknown }[] }>({
    label: 'kers: meeting prep',
    system: [
      'You are Kers, the mascot of SkillRev\'s monthly engineering guild meeting. You prepare the',
      'admin who hosts it. For each agenda segment, write 2 or 3 short talking points the host can',
      'raise, and one opener: a single line or question to start the segment with.',
      'Use only what is in the input: the segment and the board posts behind it, their comments and',
      'vote counts. Where the comments disagree, a point can name the split. Never invent facts,',
      'numbers, names or links, and never name anyone. Plain and direct, a little dry. Each point',
      'under 140 characters, the opener under 160. No emoji, no markdown.',
      'Return one entry per segment id you were given.',
    ].join('\n'),
    prompt: JSON.stringify({ segments: facts }, null, 2),
    schema: {
      type: 'object',
      properties: {
        segments: {
          type: 'array',
          items: {
            type: 'object',
            properties: { id: { type: 'string' }, points: { type: 'array', items: { type: 'string' } }, opener: { type: 'string' } },
            required: ['id', 'points', 'opener'],
          },
        },
      },
      required: ['segments'],
    },
  }).catch(() => null)

  const drafts = new Map<string, Prep>()
  for (const d of result?.segments ?? []) {
    if (typeof d?.id !== 'string') continue
    const prep = cleanPrep({ points: d.points, opener: d.opener, by: 'kers' })
    if (prep) drafts.set(d.id, prep)
  }

  // Re-read just before writing: an admin may have saved in the meantime.
  const at = new Date().toISOString()
  const latest = await readAgenda(cycleId)
  let drafted = 0
  const next = latest.map(s => {
    if (!targets.some(t => t.id === s.id)) return s
    if (!opts.segmentId && !needsPrep(s, now)) return s
    const ask = [...new Set((s.topicIds ?? []).flatMap(id => [...(people.get(id) ?? [])]))].slice(0, ASK_MAX)
    const draft = drafts.get(s.id)
    if (draft) drafted++
    const prep: StoredPrep = { points: draft?.points ?? [], opener: draft?.opener ?? '', by: 'kers', at, ask }
    return { ...s, prep }
  })
  const { error } = await saveMeeting(cycleId, { agenda: next })
  if (error) console.warn('draftPrep: could not save', error.message)
  return { drafted, tried: targets.length }
}

/**
 * The "at the latest" trigger: inside the 3 h before the meeting, before it
 * starts, fill whatever prep is still missing. Cheap when there's nothing
 * to do (one read).
 */
export async function ensurePrepBeforeMeeting(cycle: { id: string; meeting_at: string | null }, startedAt: string | null): Promise<void> {
  if (!cycle.meeting_at || startedAt) return
  const until = new Date(cycle.meeting_at).getTime() - Date.now()
  if (until > MEET_LEAD_MS || until < -MEET_LEAD_MS) return
  const now = Date.now()
  if ((await readAgenda(cycle.id)).some(s => needsPrep(s, now))) await draftPrep(cycle.id)
}

/** The board posts on the presenter screen: title, text and counts. No names. */
export interface PresenterPost {
  id: string
  title: string
  description: string
  voteCount: number
  commentCount: number
}

export async function presenterPosts(agenda: Segment[]): Promise<Record<string, PresenterPost>> {
  const ids = [...new Set(agenda.flatMap(s => s.topicIds ?? []))]
  if (!ids.length) return {}
  const { data } = await createAdminClient().from('topics').select('id, title, description, vote_count, comment_count').in('id', ids).eq('is_deleted', false)
  return Object.fromEntries((data ?? []).map(t => [t.id, { id: t.id, title: t.title, description: t.description ?? '', voteCount: t.vote_count ?? 0, commentCount: t.comment_count ?? 0 }]))
}
