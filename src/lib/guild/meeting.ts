import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { aiJson } from '@/lib/ai'
import { openCycle, slotsFor } from '@/lib/guild/demos'
import { serializeTopic } from '@/lib/utils/anonymity'
import { RADAR_TOP } from '@/lib/radar'
import { formatLabel } from '@/lib/showtell'
import { escapeSlack, extLink, appLink } from '@/lib/slack/send'
import { OUTCOME_LABELS } from '@/lib/constants'
import { cleanAgenda, type Meeting, type Prep, type Segment } from '@/lib/meeting'

/** Prep as stored: what admins see, plus "who to ask", which never leaves the server. */
type StoredPrep = Prep & { ask?: string[] }
type StoredSegment = Omit<Segment, 'prep'> & { prep?: StoredPrep | null }

/** The agenda as the client may see it: every prep without its `ask`. */
function publicAgenda(raw: unknown): Segment[] {
  if (!Array.isArray(raw)) return []
  return (raw as StoredSegment[]).map(s => {
    if (!s?.prep) return { ...s, prep: s?.prep ?? null } as Segment
    const { ask: _ask, ...prep } = s.prep
    return { ...s, prep } as Segment
  })
}

/** The agenda exactly as stored, `ask` included. Server only. */
async function storedAgenda(cycleId: string): Promise<StoredSegment[]> {
  const { data } = await createAdminClient().from('meetings').select('agenda').eq('cycle_id', cycleId).maybeSingle()
  return Array.isArray(data?.agenda) ? (data.agenda as StoredSegment[]) : []
}

/**
 * An edited agenda from the Run tab, ready to store: the stored `ask` is
 * kept for each segment (the client never had it), and a prep the admin
 * changed (or emptied: the editor sends it with `by: 'admin'`) is marked as
 * theirs, so Kers never redrafts over it.
 */
export async function mergeAgenda(cycleId: string, raw: unknown): Promise<StoredSegment[]> {
  const before = new Map((await storedAgenda(cycleId)).map(s => [s.id, s]))
  return cleanAgenda(raw).map(seg => {
    const old = before.get(seg.id)?.prep ?? null
    const prep = seg.prep
    // No prep sent (a rebuilt segment, say): Kers drafts it again later.
    if (!prep) return { ...seg, prep: null }
    const same = !!old && old.opener === prep.opener && JSON.stringify(old.points) === JSON.stringify(prep.points)
    return {
      ...seg,
      prep: same ? { ...old!, ...prep, by: old!.by, at: old!.at } : { ...prep, by: 'admin' as const, at: new Date().toISOString(), ask: old?.ask ?? [] },
    }
  })
}

/** This month's meeting row, or an empty one (before migration 041 too). */
export async function getMeeting(cycleId: string): Promise<Meeting> {
  const { data } = await createAdminClient().from('meetings').select('*').eq('cycle_id', cycleId).maybeSingle()
  return {
    cycleId,
    meetUrl: data?.meet_url ?? null,
    agenda: publicAgenda(data?.agenda),
    notes: Array.isArray(data?.notes) ? data.notes : [],
    recordingUrl: data?.recording_url ?? null,
    recap: data?.recap ?? null,
    agendaPostedAt: data?.agenda_posted_at ?? null,
    recapPostedAt: data?.recap_posted_at ?? null,
    startedAt: data?.started_at ?? null,
    endedAt: data?.ended_at ?? null,
    presenterId: data?.presenter_id ?? null,
    currentSegment: data?.current_segment ?? null,
    segmentStartedAt: data?.segment_started_at ?? null,
    // No row yet reads as ready: the first write will say if 045 is missing.
    presenterReady: !data || 'presenter_id' in data,
  }
}

/** Whether a write failed only because migration 045 isn't applied. */
export function missing045(error: { message: string } | null): boolean {
  return !!error && /presenter_id|current_segment|segment_started_at/.test(error.message)
}

export async function saveMeeting(cycleId: string, patch: Record<string, unknown>) {
  return createAdminClient()
    .from('meetings')
    .upsert({ cycle_id: cycleId, ...patch, updated_at: new Date().toISOString() })
}

/**
 * The agenda the format implies, filled from what the guild has already
 * lined up: the Radar's top three, who's on for Show & Tell, the top topic
 * (and who opens it: the proposer, or the host for a ghost post), and the
 * problems for the clinic. Organisers edit it from here.
 */
export async function draftAgenda(cycleId: string, viewerId: string): Promise<Segment[]> {
  const admin = createAdminClient()
  const since = (await admin.from('cycles').select('opens_at, created_at').eq('id', cycleId).maybeSingle()).data
  const [{ data: links }, { data: bytes }, slots, { data: topics }] = await Promise.all([
    admin.from('radar_links').select('title, vote_count').eq('cycle_id', cycleId).eq('is_deleted', false).order('vote_count', { ascending: false }).limit(RADAR_TOP),
    admin
      .from('bytes')
      .select('source_title, interest_count, byte_digests!inner(status)')
      .eq('byte_digests.status', 'published')
      .gte('created_at', since?.opens_at ?? since?.created_at ?? new Date(Date.now() - 31 * 86_400_000).toISOString())
      .gt('interest_count', 0)
      .order('interest_count', { ascending: false })
      .limit(RADAR_TOP),
    slotsFor(admin, cycleId),
    admin.from('topics').select('*, users!topics_user_id_fkey(username)').eq('cycle_id', cycleId).eq('is_deleted', false).eq('is_system', false).order('score', { ascending: false }),
  ])

  const radar = [...(links ?? []).map(l => ({ t: l.title, v: l.vote_count })), ...(bytes ?? []).map(b => ({ t: b.source_title, v: b.interest_count }))]
    .sort((a, b) => b.v - a.v)
    .slice(0, RADAR_TOP)
    .map(r => r.t)
  const ts = (topics ?? []).map(t => serializeTopic(t, viewerId))
  const ordered = [...ts.filter(t => t.is_selected), ...ts.filter(t => !t.is_selected)]
  const top = ordered.find(t => t.category !== 'problem') ?? ordered[0]
  const problems = ordered.filter(t => t.category === 'problem' && t.id !== top?.id).slice(0, 2)
  const opener = (t: { is_anonymous?: boolean; author_username?: string }) =>
    t.is_anonymous ? 'Posted anonymously: the host frames it' : `@${t.author_username} opens with three minutes`
  const slot = (s: typeof slots.spotlight, label: string) =>
    s ? `${label}: @${s.username}, ${s.title || formatLabel(s.format)}` : `${label}: open`

  return [
    { id: 'radar', kind: 'radar', title: 'Radar', minutes: 5, detail: radar.length ? radar.join(' · ') : 'Three things that shipped this month (vote on the Bytes page)' },
    { id: 'showtell', kind: 'showtell', title: 'Show & Tell', minutes: 20, detail: `${slot(slots.spotlight, 'Spotlight')} · ${slot(slots.demo, 'Demo')}` },
    { id: 'topic', kind: 'topic', title: top ? top.title : 'Top topic', minutes: 20, detail: top ? opener(top) : 'The most-voted topic on the board', topicIds: top ? [top.id] : [] },
    { id: 'clinic', kind: 'clinic', title: 'Problem clinic', minutes: 10, detail: problems.length ? problems.map(p => p.title).join(' · ') : 'One or two real blockers from the board', topicIds: problems.map(p => p.id) },
    { id: 'wrap', kind: 'wrap', title: 'Wrap', minutes: 5, detail: 'Decisions, owners, and who shows something next month' },
  ]
}

function when(iso: string | null): string {
  if (!iso) return 'date to be announced'
  return new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

/** The agenda as a Slack message for the guild channel. */
export function agendaMessage(label: string, meetingAt: string | null, m: Meeting) {
  const lines = m.agenda.map(s => `• *${escapeSlack(s.title)}* (${s.minutes} min)${s.detail ? `: ${escapeSlack(s.detail)}` : ''}`)
  const text = [
    `*${escapeSlack(label)} guild meeting* · ${when(meetingAt)} IST`,
    ...lines,
    m.meetUrl ? `Join: ${extLink(m.meetUrl, 'the call')}` : '',
    `Vote and add to the Radar on ${appLink('/board', 'GuildBoard')}`,
  ].filter(Boolean).join('\n')
  return { text }
}

export function recapMessage(label: string, m: Meeting) {
  const text = [
    `*${escapeSlack(label)} guild meeting: the recap*`,
    escapeSlack(m.recap ?? ''),
    m.recordingUrl ? `Recording: ${extLink(m.recordingUrl, 'watch it')}` : '',
    `Next month's board: ${appLink('/board', 'GuildBoard')}`,
  ].filter(Boolean).join('\n\n')
  return { text }
}

/**
 * Kers' first draft of the recap, from what was actually captured: the
 * agenda, the notes and decisions, topic outcomes and Show & Tell. Written
 * as the organiser (it's posted under their name in Slack), plain, short.
 * Falls back to a list built straight from the notes.
 */
export async function draftRecap(cycleId: string, label: string, m: Meeting): Promise<{ recap: string; byAi: boolean }> {
  const admin = createAdminClient()
  const [{ data: topics }, slots] = await Promise.all([
    admin.from('topics').select('title, outcome_tag, outcome_note').eq('cycle_id', cycleId).eq('is_deleted', false).not('outcome_tag', 'is', null),
    slotsFor(admin, cycleId),
  ])
  const decisions = m.notes.filter(n => n.decision)
  const facts = {
    month: label,
    agenda: m.agenda.map(s => ({ title: s.title, detail: s.detail })),
    notes: m.notes.map(n => ({ text: n.text, owner: n.owner, decision: n.decision })),
    topic_outcomes: (topics ?? []).map(t => ({ title: t.title, outcome: OUTCOME_LABELS[t.outcome_tag] ?? t.outcome_tag, note: t.outcome_note })),
    spotlight: slots.spotlight ? { by: slots.spotlight.username, title: slots.spotlight.title } : null,
    demo: slots.demo ? { by: slots.demo.username, title: slots.demo.title } : null,
  }

  const fallback = [
    `Thanks to everyone who came to the ${label} guild meeting.`,
    slots.spotlight ? `Spotlight: @${slots.spotlight.username}${slots.spotlight.title ? ` on ${slots.spotlight.title}` : ''}.` : '',
    slots.demo ? `Demo: @${slots.demo.username}${slots.demo.title ? ` showed ${slots.demo.title}` : ''}.` : '',
    decisions.length ? `Decisions:\n${decisions.map(d => `- ${d.text}${d.owner ? ` (${d.owner})` : ''}`).join('\n')}` : '',
    (topics ?? []).length ? `Topics: ${(topics ?? []).map(t => `${t.title} (${OUTCOME_LABELS[t.outcome_tag] ?? t.outcome_tag})`).join('; ')}.` : '',
    'Next month’s board is open: post what you want to hear about.',
  ].filter(Boolean).join('\n')

  const result = await aiJson<{ recap?: unknown }>({
    label: 'kers: meeting recap',
    tier: 'bulk',
    system: [
      'You write the recap of a monthly engineering guild meeting at SkillRev, posted in',
      'Slack by the organiser under their own name. Plain, warm, short: under 900 characters.',
      'Use only what is in the input: who presented, decisions and owners, topic outcomes.',
      'Never invent names, numbers, decisions or links. Thank presenters by their @handle.',
      'Structure: one thank-you line, then short lines for Show & Tell, decisions (with',
      'owners) and topics, then one line inviting people to next month\'s board. No emoji.',
    ].join('\n'),
    prompt: JSON.stringify(facts, null, 2),
    schema: { type: 'object', properties: { recap: { type: 'string' } }, required: ['recap'] },
  }).catch(() => null)

  const recap = typeof result?.recap === 'string' ? result.recap.replace(/https?:\/\/\S+/g, '').trim() : ''
  return recap && recap.length <= 1500 ? { recap, byAi: true } : { recap: fallback, byAi: false }
}

export { openCycle }
