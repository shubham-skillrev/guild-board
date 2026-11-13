import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { aiJson } from '@/lib/ai'
import { mergeAgenda, saveMeeting } from '@/lib/guild/meeting'
import { meetPosts } from '@/lib/guild/meetingPrep'
import { missing046 } from '@/lib/meet/room'
import { planActivities, withActivities, type ActivityPlan, type ActivityRowLite } from '@/lib/meet/agendaEdit'
import { cleanAgenda, cleanMeme, KIND_LABELS, LIMITS, MEME_FACES, type MeetPost, type Segment } from '@/lib/meeting'

/**
 * The slide editor's server side (docs/08-meeting-mode-v2.md, Batch 3):
 * saving the edited agenda (and its activity rows), Kers' kept draft, and
 * "Rewrite with Kers". The route checks the caller is an admin and that the
 * slides aren't locked (lib/meet/agendaEdit.ts editLocked).
 */

type Admin = ReturnType<typeof createAdminClient>

/**
 * Whether an error only means migration 050 isn't applied: the Boss Round's
 * stage kinds (predict, fill) break meeting_activities' original kind check.
 */
export function missing050(error: { message?: string; code?: string } | null | undefined): boolean {
  return !!error && /meeting_activities_kind_check/.test(error.message ?? '')
}

export const NEEDS_050 = 'Boss Round stages need migration 050: apply it, then edit the slide again.'

/** Whether an error only means migration 049 (agenda_draft) isn't applied. */
export function missing049(error: { message?: string } | null | undefined): boolean {
  return !!error && /agenda_draft/.test(error.message ?? '')
}

async function activityRows(admin: Admin, cycleId: string): Promise<{ rows: ActivityRowLite[]; ready: boolean }> {
  const { data, error } = await admin.from('meeting_activities').select('id, segment_id, kind, prompt, options, config, status').eq('cycle_id', cycleId)
  if (error) {
    if (!missing046(error)) console.warn('meeting editor: could not read activities', error.message)
    return { rows: [], ready: false }
  }
  return { rows: (data ?? []) as ActivityRowLite[], ready: true }
}

/** How many answers each activity has, by row id. */
async function answerCounts(admin: Admin, ids: string[]): Promise<Record<string, number>> {
  if (!ids.length) return {}
  const { data } = await admin.from('meeting_responses').select('activity_id').in('activity_id', ids)
  const out: Record<string, number> = {}
  for (const r of data ?? []) out[r.activity_id] = (out[r.activity_id] ?? 0) + 1
  return out
}

export interface SyncResult {
  created: number
  updated: number
  removed: number
  /** Slides whose row was kept as it was (it has answers). */
  kept: string[]
  /** Activity slides not written yet (no question, or a poll with fewer than two options). */
  incomplete: string[]
  /** False before migration 046: no rows are written. */
  ready: boolean
  /** Boss stage slides (predict / fill) not written: migration 050 isn't applied. */
  needs050?: string[]
  error?: string
}

/**
 * The month's meeting_activities brought in line with the agenda
 * (lib/meet/agendaEdit.ts planActivities): what makes the old seed script
 * unnecessary. Deletes first, so a slide id freed by a delete can be reused.
 */
export async function syncActivities(cycleId: string, agenda: Segment[], known?: ActivityRowLite[]): Promise<SyncResult> {
  const admin = createAdminClient()
  const { rows, ready } = known ? { rows: known, ready: true } : await activityRows(admin, cycleId)
  if (!ready) return { created: 0, updated: 0, removed: 0, kept: [], incomplete: [], ready: false }
  const plan: ActivityPlan = planActivities(agenda, rows, await answerCounts(admin, rows.map(r => r.id)))
  const needs050: string[] = []
  // Before 050 a stage kind breaks the kind check: those slides wait, everything else still saves.
  const fail = (e: { message: string } | null, slide?: string) => {
    if (e && missing050(e)) {
      if (slide) needs050.push(slide)
      return null
    }
    return e ? e.message : null
  }
  const slideOf = new Map(rows.map(r => [r.id, r.segment_id]))
  const stage = (k: unknown) => k === 'predict' || k === 'fill'
  let error: string | null = null
  if (plan.remove.length) error ??= fail((await admin.from('meeting_activities').delete().in('id', plan.remove)).error)
  for (const u of plan.update) error ??= fail((await admin.from('meeting_activities').update(u.patch).eq('id', u.id)).error, slideOf.get(u.id))
  const plain = plan.insert.filter(r => !stage(r.kind))
  if (plain.length) error ??= fail((await admin.from('meeting_activities').insert(plain.map(r => ({ ...r, cycle_id: cycleId, status: 'ready' })))).error)
  for (const r of plan.insert.filter(r => stage(r.kind))) error ??= fail((await admin.from('meeting_activities').insert({ ...r, cycle_id: cycleId, status: 'ready' })).error, r.segment_id)
  if (error) console.warn('meeting editor: activity sync failed', error)
  return {
    created: plan.insert.length - needs050.filter(id => plan.insert.some(r => r.segment_id === id)).length,
    updated: plan.update.length,
    removed: plan.remove.length,
    kept: plan.kept,
    incomplete: plan.incomplete,
    ready: true,
    ...(needs050.length ? { needs050 } : {}),
    ...(error ? { error } : {}),
  }
}

/**
 * The editor's autosave: the agenda through mergeAgenda (cleanAgenda, and
 * each prep's server-only "who to ask" kept), then its activity rows. The
 * first save over an agenda that has no kept draft keeps the agenda as it
 * stood (with its activities) as the draft, so "Reset to Kers draft" works
 * for a month drafted before migration 049 too.
 */
export async function saveEditedAgenda(cycleId: string, raw: unknown): Promise<{ agenda: Segment[]; sync: SyncResult; error?: string }> {
  const admin = createAdminClient()
  const [{ data: row }, before] = await Promise.all([admin.from('meetings').select('*').eq('cycle_id', cycleId).maybeSingle(), activityRows(admin, cycleId)])
  const merged = await mergeAgenda(cycleId, raw)
  const patch: Record<string, unknown> = { agenda: merged }
  if (row && 'agenda_draft' in row && !Array.isArray(row.agenda_draft) && Array.isArray(row.agenda) && row.agenda.length) {
    patch.agenda_draft = withActivities(row.agenda as Segment[], before.rows)
  }
  const { error } = await saveMeeting(cycleId, patch)
  if (error) return { agenda: merged as Segment[], sync: { created: 0, updated: 0, removed: 0, kept: [], incomplete: [], ready: before.ready }, error: error.message }
  const sync = before.ready ? await syncActivities(cycleId, merged as Segment[], before.rows) : { created: 0, updated: 0, removed: 0, kept: [], incomplete: [], ready: false }
  return { agenda: cleanAgenda(merged), sync }
}

/** Keeps Kers' freshly built agenda as the month's draft (best effort: before 049 it just isn't kept). */
export async function keepDraft(cycleId: string, agenda: Segment[]): Promise<void> {
  const { error } = await saveMeeting(cycleId, { agenda_draft: agenda })
  if (error && !missing049(error)) console.warn('meeting editor: could not keep the draft', error.message)
}

/** "Reset to Kers draft": the kept draft saved as the agenda (activities synced). */
export async function resetToDraft(cycleId: string): Promise<{ agenda: Segment[]; sync: SyncResult } | { error: string; status: number }> {
  const { data, error } = await createAdminClient().from('meetings').select('agenda_draft').eq('cycle_id', cycleId).maybeSingle()
  if (missing049(error)) return { error: 'Apply migration 049 first: no Kers draft is kept before it.', status: 500 }
  if (error) return { error: error.message, status: 500 }
  if (!Array.isArray(data?.agenda_draft) || !data.agenda_draft.length) return { error: 'No Kers draft kept for this month yet.', status: 404 }
  const r = await saveEditedAgenda(cycleId, data.agenda_draft)
  return r.error ? { error: r.error, status: 500 } : r
}

/** This month's board posts, for `+ Add` › Topic from the board (as the board shows them to anyone). */
export async function boardPosts(cycleId: string): Promise<Record<string, MeetPost>> {
  const { data } = await createAdminClient().from('topics').select('id').eq('cycle_id', cycleId).eq('is_deleted', false).eq('is_system', false).order('score', { ascending: false }).limit(40)
  return meetPosts((data ?? []).map(t => t.id as string))
}

const REWRITE_SYSTEM = `You are Kers, the mascot of a fully remote monthly engineering guild meeting. The organiser asks you to rewrite one slide of the meeting's deck. Engineers, QA, PMs and DevOps attend; most stay muted, so a slide's job is to give them a reason to vote, type or talk. A slide is read from across a room in two seconds: fewer words always win.

Keep the slide's purpose and facts; improve the words. Return only the fields for its type:
- title / content / results / text slides: a title (under 40 characters; a text slide's title is one big statement or question under 60) and a cue (under 90 characters: one line telling the room what to do now, never a note to the host).
- activity: a short title, a cue telling the room to vote or type, and the prompt (the question on every phone, under 120 characters). For a poll, the same number of options, each under 40 characters, distinct and fair to every camp.
- meme: one or two panels, each Kers (a mint blob) with a face (smug, proud, dramatic, excited, bored, nosy, sleepy, grumpy, relieved, lonely), a label under 20 characters and a line under 50, and an optional caption. Original, workplace-safe developer humour about the slide's section. Never a known meme format by name, never a real person, never mocking anyone in the room.

Voice: a witty teammate, dry, a little cheeky, never mean. English only. No emoji, no exclamation marks, no corporate words, no links. Never invent facts, numbers or names. Return JSON only.`

const REWRITE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string' },
    cue: { type: 'string' },
    prompt: { type: 'string' },
    options: { type: 'array', items: { type: 'string' } },
    panels: { type: 'array', items: { type: 'object', properties: { label: { type: 'string' }, text: { type: 'string' }, face: { type: 'string', enum: [...MEME_FACES] } }, required: ['label', 'text', 'face'] } },
    caption: { type: 'string' },
  },
  required: ['title'],
} as const

const plain = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim().slice(0, max) : '')

/**
 * "Rewrite with Kers" for one slide: a suggestion, never saved. The editor
 * shows it beside the slide and the admin takes it or leaves it. Null when
 * no model answered (or there's nothing to rewrite, an image meme).
 */
export async function rewriteSlide(raw: unknown, monthLabel: string): Promise<Partial<Segment> | null> {
  const [s] = cleanAgenda([raw])
  if (!s || (s.slide === 'meme' && s.meme?.src)) return null
  const posts = s.topicIds?.length ? await meetPosts(s.topicIds) : {}
  const material = {
    month: monthLabel,
    section: s.section ?? KIND_LABELS[s.kind],
    slide: s.slide ?? 'content',
    title: s.title,
    cue: s.cue ?? '',
    ...(s.activity ? { activity: { kind: s.activity.kind, prompt: s.activity.prompt, ...(s.activity.kind === 'poll' ? { options: s.activity.options } : {}) } } : {}),
    ...(s.meme ? { meme: s.meme } : {}),
    ...(s.cards?.length ? { text_on_slide: s.cards.flatMap(c => (c.kind === 'side' ? [`${c.label}: ${c.text}`] : c.kind === 'note' ? [c.title] : c.kind === 'news' ? [c.title] : [])) } : {}),
    posts: Object.values(posts).map(p => ({ title: p.title, text: p.description.slice(0, 700) })),
  }
  const out = await aiJson<{ title?: unknown; cue?: unknown; prompt?: unknown; options?: unknown; panels?: unknown; caption?: unknown }>({
    label: 'kers: rewrite slide',
    system: REWRITE_SYSTEM,
    prompt: JSON.stringify(material, null, 2),
    schema: REWRITE_SCHEMA,
    // An admin is watching the button.
    timeoutMs: 20_000,
  }).catch(() => null)
  if (!out) return null
  if (s.slide === 'meme') {
    const meme = cleanMeme({ panels: out.panels, caption: out.caption })
    return meme ? { meme } : null
  }
  const title = plain(out.title, LIMITS.title)
  const cue = plain(out.cue, LIMITS.cue)
  const suggestion: Partial<Segment> = { ...(title ? { title } : {}), ...(cue ? { cue } : {}) }
  // A Boss stage's code and answers are the admin's; only a poll or cloud (or a stage's question) is reworded.
  if (s.activity && s.activity.kind !== 'boss') {
    const prompt = plain(out.prompt, LIMITS.prompt)
    const options = Array.isArray(out.options) ? out.options.map(o => plain(o, LIMITS.option)).filter(Boolean) : []
    const fits = s.activity.kind === 'poll' && options.length >= 2 && options.length <= LIMITS.options
    if (prompt || fits) suggestion.activity = { ...s.activity, ...(prompt ? { prompt } : {}), ...(fits ? { options } : {}) }
  }
  return Object.keys(suggestion).length ? suggestion : null
}
