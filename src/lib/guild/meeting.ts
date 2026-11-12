import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { aiJson } from '@/lib/ai'
import { openCycle, slotsFor } from '@/lib/guild/demos'
import { serializeTopic } from '@/lib/utils/anonymity'
import { RADAR_TOP } from '@/lib/radar'
import { escapeSlack, extLink, appLink } from '@/lib/slack/send'
import { OUTCOME_LABELS } from '@/lib/constants'
import { cleanAgenda, cleanCards, cleanMeme, cleanUrl, LIMITS, sectionsOf, type Card, type Meeting, type Prep, type Segment } from '@/lib/meeting'
import { AGENDA_SCHEMA, AGENDA_SYSTEM, exampleFor, type ReferenceAgenda } from '@/lib/meetingPrompts'
import reference from '../../../docs/agendas/2026-11.json'

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

/** A Radar candidate: a member's link or a digest byte, as the agenda model sees it. */
interface RadarCandidate {
  key: string
  title: string
  about: string
  source: string
  url: string
  votes: number
  from: 'member' | 'digest'
}

const noLinks = (t: string) => t.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1').replace(/https?:\/\/\S+/g, '').trim()

/**
 * The slides the format implies (docs/07-agenda-and-script-guide.md), filled
 * from what the guild has already lined up: the Radar's top three, the top
 * topic, and the problems for the clinic. Then the model words it (titles,
 * cues, plain text, the memes, the Radar's picks); whatever it gets wrong or
 * doesn't answer keeps the plain version. Organisers edit it from here.
 */
export async function draftAgenda(cycleId: string, viewerId: string): Promise<Segment[]> {
  const admin = createAdminClient()
  const cycle = (await admin.from('cycles').select('label, theme, opens_at, created_at').eq('id', cycleId).maybeSingle()).data
  const [{ data: links }, { data: bytes }, { data: topics }] = await Promise.all([
    admin.from('radar_links').select('id, title, note, url, vote_count').eq('cycle_id', cycleId).eq('is_deleted', false).order('vote_count', { ascending: false }).limit(6),
    admin
      .from('bytes')
      .select('id, source_title, source_name, url, summary, interest_count, byte_digests!inner(status)')
      .eq('byte_digests.status', 'published')
      .gte('created_at', cycle?.opens_at ?? cycle?.created_at ?? new Date(Date.now() - 31 * 86_400_000).toISOString())
      .gt('interest_count', 0)
      .order('interest_count', { ascending: false })
      .limit(6),
    admin.from('topics').select('*, users!topics_user_id_fkey(username)').eq('cycle_id', cycleId).eq('is_deleted', false).eq('is_system', false).order('score', { ascending: false }),
  ])

  const domain = (url: string) => { try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' } }
  // Votes first; on a tie a member's link beats a digest byte (the stable sort keeps links ahead).
  const candidates: RadarCandidate[] = [
    ...(links ?? []).map(l => ({ key: `link:${l.id}`, title: l.title, about: l.note ?? '', source: domain(l.url), url: l.url, votes: l.vote_count ?? 0, from: 'member' as const })),
    ...(bytes ?? []).map(b => ({ key: `byte:${b.id}`, title: b.source_title, about: b.summary ?? '', source: b.source_name ?? '', url: b.url ?? '', votes: b.interest_count ?? 0, from: 'digest' as const })),
  ].sort((a, b) => b.votes - a.votes)
  const radar = candidates.slice(0, RADAR_TOP).map(r => r.title)

  const ts = (topics ?? []).map(t => serializeTopic(t, viewerId))
  const ordered = [...ts.filter(t => t.is_selected), ...ts.filter(t => !t.is_selected)]
  const top = ordered.find(t => t.category !== 'problem') ?? ordered[0]
  const problems = ordered.filter(t => t.category === 'problem' && t.id !== top?.id).slice(0, 2)
  const opener = (t: { is_anonymous?: boolean; author_username?: string }) =>
    t.is_anonymous ? 'Posted anonymously: the host frames it' : `@${t.author_username} opens with three minutes`

  // Cards the server builds from real data, never the model: the Radar's news (with real links) and the posts.
  const news = (c: RadarCandidate): Card => ({ kind: 'news', title: c.title.slice(0, LIMITS.cardTitle), source: c.source.slice(0, LIMITS.source), ...(cleanUrl(c.url) ? { url: c.url } : {}), why: noLinks(c.about).replace(/\s+/g, ' ').slice(0, LIMITS.cardText), from: c.from })
  const posts = (ids: string[]): Card[] => ids.map(postId => ({ kind: 'post', postId }))

  // The format as slides (docs/06-meeting-mode.md, "Slides"). Activity slide
  // ids match the reference month's, and the activity seed
  // (scripts/seed-meeting-activities.mjs) lands on activity slides by kind.
  type Plain = Omit<Segment, 'minutes'> & { minutes?: number }
  const W = 'Warm-up', R = 'Radar', T = 'Topic', C = 'Problem clinic', B = 'Boss Round', X = 'Wrap'
  const slides: Plain[] = [
    { id: 'hello', kind: 'warmup', slide: 'title', section: W, title: `${cycle?.label ?? 'This month'}’s guild meeting`, cue: 'Phones out: open GuildBoard and join the room.', detail: 'A word cloud on phones to start.' },
    { id: 'warmup-cloud', kind: 'warmup', slide: 'activity', section: W, title: 'One word for your week', cue: 'One word on your phone. Nobody sees who typed what.', detail: '' },
    { id: 'warmup-results', kind: 'warmup', slide: 'results', section: W, of: 'warmup-cloud', title: 'Your week, in words', cue: 'Biggest word wins. Who typed the odd one out?', detail: '' },
    { id: 'meme-radar', kind: 'radar', slide: 'meme', section: R, title: '', detail: '', meme: { panels: [{ label: 'Me', text: 'I’ll read the news later.', face: 'relieved' }, { label: 'Also me', text: '47 open tabs.', face: 'dramatic' }] } },
    { id: 'radar-intro', kind: 'radar', slide: 'title', section: R, title: 'Radar', cue: 'Three things from this month, then a vote.', detail: radar.length ? radar.join(' · ') : 'Three things that shipped this month (vote on the Bytes page)' },
    { id: 'radar-news', kind: 'radar', slide: 'content', section: R, title: 'This month’s Radar', cue: 'Tap one on your phone to read it.', detail: '', cards: candidates.slice(0, RADAR_TOP).map(news) },
    { id: 'radar-poll', kind: 'radar', slide: 'activity', section: R, title: 'Vote', cue: 'Vote on your phone.', detail: '' },
    { id: 'radar-results', kind: 'radar', slide: 'results', section: R, of: 'radar-poll', title: 'The room says', cue: 'Smallest camp: defend it.', detail: '' },
    { id: 'meme-topic', kind: 'topic', slide: 'meme', section: T, title: '', detail: '', meme: { panels: [{ label: 'The plan', text: 'A quick discussion.', face: 'smug' }, { label: 'The meeting', text: 'Forty replies later.', face: 'sleepy' }] } },
    { id: 'topic-post', kind: 'topic', slide: 'content', section: T, title: top ? top.title.slice(0, LIMITS.title) : 'Top topic', cue: 'Read it, then pick a side.', detail: top ? opener(top) : 'The most-voted topic on the board', topicIds: top ? [top.id] : [], cards: posts(top ? [top.id] : []) },
    { id: 'topic-poll', kind: 'topic', slide: 'activity', section: T, title: 'Pick a side', cue: 'Vote before you overthink it.', detail: '' },
    { id: 'topic-results', kind: 'topic', slide: 'results', section: T, of: 'topic-poll', title: 'The split', cue: 'Smallest camp first: why?', detail: '' },
    problems.length
      ? { id: 'clinic-intro', kind: 'clinic', slide: 'content', section: C, title: 'Problem clinic', cue: 'Real blockers from the board.', detail: problems.map(p => p.title).join(' · '), topicIds: problems.map(p => p.id), cards: posts(problems.map(p => p.id)) }
      : { id: 'clinic-intro', kind: 'clinic', slide: 'title', section: C, title: 'Name the blocker', cue: 'No problem posts this month, so the room sets the agenda.', detail: 'The room sets the agenda: a word cloud of one-word blockers.' },
    { id: 'clinic-cloud', kind: 'clinic', slide: 'activity', section: C, title: 'Your biggest blocker', cue: 'One word. Nobody sees who typed what.', detail: '' },
    { id: 'clinic-results', kind: 'clinic', slide: 'results', section: C, of: 'clinic-cloud', title: 'This month’s blockers', cue: 'Top two get three minutes each. One owner, one next step.', detail: '' },
    { id: 'boss-intro', kind: 'boss', slide: 'title', section: B, title: 'Kers’ Boss Round', cue: 'You lot tell me what to write all day. Let’s see if you can still code.', detail: 'Kers dares the room to write some code, in their own browser.' },
    { id: 'boss-round', kind: 'boss', slide: 'activity', section: B, title: 'Boss Round', cue: 'On your phone or laptop. Run the tests as often as you like.', detail: '' },
    { id: 'boss-verdict', kind: 'boss', slide: 'results', section: B, of: 'boss-round', title: 'Kers’ verdict', cue: 'What tripped you?', detail: '' },
    { id: 'wrap-asks', kind: 'wrap', slide: 'content', section: X, title: 'Before you go', cue: 'One line: what will you actually try this week?', detail: 'Decisions and owners, a volunteer for next month, one Radar link each.', cards: [
      { kind: 'note', title: 'Decisions and owners', text: 'read back from today’s notes' },
      { kind: 'note', title: 'Next month’s desk tour', text: 'one volunteer, now' },
      { kind: 'note', title: 'One Radar link each', text: 'before next month' },
    ] },
  ]
  const plain: Segment[] = slides.map(s => ({ minutes: 0, topicIds: [], ...s }))

  const theme = (cycle?.theme ?? null) as { name?: string; blurb?: string } | null
  const material = {
    month: cycle?.label ?? '',
    theme: theme?.name ? { name: theme.name, about: theme.blurb ?? '' } : null,
    skeleton: plain.map(s => ({ id: s.id, section: s.section, kind: s.kind, slide: s.slide, plain_title: s.title, plain_cue: s.cue ?? '' })),
    radar_candidates: candidates.map(c => ({ key: c.key, title: c.title, about: noLinks(c.about).slice(0, 400), source: c.source, votes: c.votes, from: c.from })),
    posts: ordered.slice(0, 8).map(t => ({
      title: t.title,
      text: noLinks(t.description ?? '').slice(0, 700),
      category: t.category,
      votes: t.vote_count ?? 0,
      comments: t.comment_count ?? 0,
      selected_by_admin: !!t.is_selected,
      opens_it: opener(t),
      on_agenda_as: t.id === top?.id ? 'topic' : problems.some(p => p.id === t.id) ? 'clinic' : null,
    })),
  }

  const framed = await aiJson<Framed>({
    label: 'kers: meeting agenda',
    system: AGENDA_SYSTEM,
    prompt: [
      'A reference agenda that met the standard (a past month; take its shape and tone, never its facts):',
      exampleFor(reference as ReferenceAgenda, false),
      '',
      'This month\'s skeleton and material:',
      JSON.stringify(material, null, 2),
    ].join('\n'),
    schema: AGENDA_SCHEMA,
    // An admin is watching "Building…".
    timeoutMs: 25_000,
  }).catch(() => null)
  return framed ? applyFraming(plain, framed, candidates, news) : plain
}

type Framed = { radar?: unknown; segments?: { id?: unknown; title?: unknown; detail?: unknown; cue?: unknown; cards?: unknown; meme?: unknown }[] }

/**
 * The model's words over the plain slides: a title and cue per known slide
 * (a detail on title slides only), cut to the limits and stripped of links;
 * plain text (sides and notes) on content slides only, and panels on meme
 * slides only. The Radar's news cards are built here from the candidates it
 * picked (real titles and links, its one line on why), never from its text;
 * posts stay as the server built them.
 */
function applyFraming(plain: Segment[], framed: Framed, candidates: RadarCandidate[], news: (c: RadarCandidate) => Card): Segment[] {
  const byKey = new Map(candidates.map(c => [c.key, c]))
  const picks = (Array.isArray(framed.radar) ? framed.radar : [])
    .map(p => (typeof p === 'string' ? { key: p, why: '' } : p && typeof p === 'object' ? (p as { key?: unknown; why?: unknown }) : null))
    .filter((p): p is { key: string; why?: unknown } => !!p && typeof p.key === 'string' && byKey.has(p.key))
  const byId = new Map((framed.segments ?? []).filter(f => typeof f?.id === 'string').map(f => [f.id as string, f]))
  const text = (v: unknown, max: number) => (typeof v === 'string' ? noLinks(v).replace(/\s+/g, ' ').slice(0, max).trim() : '')
  return plain.map(s => {
    const f = byId.get(s.id)
    let cards = s.cards ?? []
    if (s.kind === 'radar' && s.slide === 'content' && picks.length) {
      cards = picks.slice(0, RADAR_TOP).map(p => {
        const card = news(byKey.get(p.key)!)
        const why = text(p.why, LIMITS.cardText)
        return card.kind === 'news' && why ? { ...card, why } : card
      })
    }
    const base = cards.length ? { ...s, cards } : s
    if (!f) return base
    if (s.slide === 'meme') {
      const meme = cleanMeme(f.meme)
      return meme && !meme.src ? { ...base, meme } : base
    }
    const written = s.slide === 'content'
      ? cleanCards(f.cards).filter(c => c.kind === 'side' || c.kind === 'note').map(c => (c.kind === 'side' ? { ...c, text: noLinks(c.text) } : c.kind === 'note' ? { ...c, text: c.text && noLinks(c.text) } : c))
      : []
    const title = text(f.title, LIMITS.title)
    const detail = s.slide === 'title' && !(s.kind === 'radar' && !picks.length) ? text(f.detail, LIMITS.detail) : ''
    const cue = text(f.cue, LIMITS.cue)
    // Notes replace the plain version's notes (the Wrap's asks); posts and news stay.
    const kept = written.length ? cards.filter(c => c.kind === 'post' || c.kind === 'news') : cards
    const all = [...kept, ...written].slice(0, LIMITS.cards)
    return { ...base, title: title || s.title, detail: detail || s.detail, ...(cue ? { cue } : {}), ...(all.length ? { cards: all } : {}) }
  })
}

function when(iso: string | null): string {
  if (!iso) return 'date to be announced'
  return new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

/**
 * The agenda as a Slack message for the guild channel: one line per section
 * (its name, and the first detail any of its slides has). An old agenda of
 * timed segments keeps its minutes.
 */
export function agendaMessage(label: string, meetingAt: string | null, m: Meeting) {
  const lines = sectionsOf(m.agenda).map(sec => {
    const slides = m.agenda.slice(sec.start, sec.start + sec.slides)
    const detail = slides.find(s => s.detail)?.detail ?? ''
    const first = slides[0]
    const minutes = !first.slide && first.minutes ? ` (${first.minutes} min)` : ''
    return `• *${escapeSlack(sec.title)}*${minutes}${detail ? `: ${escapeSlack(detail)}` : ''}`
  })
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
    agenda: m.agenda.filter(s => s.slide !== 'meme' && s.title).map(s => ({ title: s.title, detail: s.detail })),
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
