import type { ActivityKind, RoomState } from '@/lib/meet/activity'
import { cleanDuration } from './meet/timer.ts'

/**
 * The monthly meeting: its agenda, the notes taken live, and the recap.
 * Shapes shared by the Run tab, meeting mode and the API (migration 041).
 */

export type SegmentKind = 'warmup' | 'radar' | 'showtell' | 'topic' | 'clinic' | 'boss' | 'wrap' | 'custom'

export const KIND_LABELS: Record<SegmentKind, string> = {
  warmup: 'Warm-up',
  radar: 'Radar',
  showtell: 'Show & Tell',
  topic: 'Topic',
  clinic: 'Problem clinic',
  boss: 'Boss Round',
  wrap: 'Wrap',
  custom: 'Segment',
}

/**
 * Kers' prep for one segment (docs/06-meeting-mode.md): 2-3 talking points
 * and one opener, drafted before the meeting and edited in the Run tab.
 * `by` says who wrote it last, so a redraft never overwrites an admin's edit
 * unless asked. "Who to ask" is stored with it on the server only and never
 * leaves it (see StoredPrep in lib/guild/meeting.ts).
 */
export interface Prep {
  points: string[]
  opener: string
  by: 'kers' | 'admin'
  at: string | null
}

/**
 * What a slide shows (docs/06-meeting-mode.md, "Slides"): on the shared
 * screen and on every phone. Public: nothing here may name anyone the board
 * doesn't already name. Only `news` and `post` are drawn as cards (real
 * content: tap to open on a phone); `side` and `note` are summary and show
 * as plain text (two columns for sides, a compact list for notes).
 *
 *   news  a Radar item: its title, where it's from, the link (phones open
 *         it), and one line on why it matters
 *   post  a board post, drawn with the board's own card (fetched server-side,
 *         ghost posts keep their ghost handle)
 *   side  one side of a debate, with its one-liner (plain text)
 *   note  a short line, with an optional second (plain text)
 */
export type Card =
  | { kind: 'news'; title: string; source: string; url?: string; why: string; from?: 'member' | 'digest' }
  | { kind: 'post'; postId: string }
  | { kind: 'side'; label: string; text: string }
  | { kind: 'note'; title: string; text?: string }

export type CardKind = Card['kind']

/** Real content, drawn as cards. The rest is plain text. */
export function isRealCard(c: Card): c is Extract<Card, { kind: 'news' | 'post' }> {
  return c.kind === 'news' || c.kind === 'post'
}

/**
 * What one slide is (docs/06-meeting-mode.md, "Slides"):
 *
 *   title     a section's intro: its title and one cue line ("Next up")
 *   content   real cards (posts, news) and/or short plain text
 *   activity  a poll, word cloud or Boss Round: arriving opens it, leaving
 *             closes it (the server does both, on `goto`)
 *   results   an activity's results, big (`of` is its slide), and a short
 *             prompt to talk about them
 *   text      one big statement or question
 *   meme      a joke between sections: a Kers meme built from text, or an
 *             image under public/meet/memes/
 *
 * An agenda from before slides has no `slide` on its items: each old
 * segment is one slide (`activity` if it has an activity, else `content`).
 */
export type SlideKind = 'title' | 'content' | 'activity' | 'results' | 'text' | 'meme'
export const SLIDE_KINDS: SlideKind[] = ['title', 'content', 'activity', 'results', 'text', 'meme']

/** Kers' faces a meme may use (his board expressions). */
export const MEME_FACES = ['smug', 'proud', 'dramatic', 'excited', 'bored', 'nosy', 'sleepy', 'grumpy', 'relieved', 'lonely'] as const
export type MemeFace = (typeof MEME_FACES)[number]

/**
 * A meme slide's content. With `src`, an image from public/meet/memes/ (and
 * `alt`); otherwise a Kers meme: one or two panels, each Kers with a face, a
 * small label and a line ("The pitch deck" / "AI-powered everything"), and an
 * optional punchline under them.
 */
export interface Meme {
  src?: string
  alt?: string
  panels?: { label: string; text: string; face: MemeFace }[]
  caption?: string
}

/**
 * An activity slide's poll, word cloud or Boss Round, as the slide editor
 * keeps it (docs/08-meeting-mode-v2.md, Batch 3). The agenda is its source:
 * saving the agenda creates or updates its meeting_activities row (keyed by
 * the slide's id, lib/meet/agendaEdit.ts planActivities). An agenda from
 * before the editor has none: its rows were seeded by script and stay as
 * they are until the editor touches the slide. Never sent to phones (they
 * get the activity from the room).
 */
export interface SlideActivity {
  kind: ActivityKind
  prompt: string
  /** poll: 2-4 options. */
  options?: string[]
  /** boss: its problem (lib/meet/boss.ts). Kept as stored. */
  config?: Record<string, unknown>
}

export const ACTIVITY_KINDS: ActivityKind[] = ['poll', 'cloud', 'boss']

/**
 * One slide of the agenda. The agenda is a flat, ordered list of slides;
 * consecutive slides with the same `section` are one section (the progress
 * line groups them, Slack lists them). `kind` is the section's kind (Radar,
 * Topic...), `slide` what the slide itself is. Named Segment for history:
 * an old agenda's segments are slides without `slide`.
 */
export interface Segment {
  id: string
  kind: SegmentKind
  /** What this slide is. Missing: an old segment (see slideKind). */
  slide?: SlideKind
  /** The section it belongs to (its title, e.g. "Radar"). Missing: its own section. */
  section?: string
  /** results: the activity slide whose results it shows. */
  of?: string
  /**
   * activity: how long its countdown runs, in whole seconds (lib/meet/timer.ts,
   * 10 s to 30 min). Missing: the kind's default (poll and word cloud 130,
   * Boss Round 300). The slide editor sets it; the server reads it when the
   * activity opens and stores `closes_at` (migration 048).
   */
  duration_s?: number
  /** meme: what it shows. */
  meme?: Meme
  /** activity: its poll, word cloud or Boss Round (the slide editor's; see SlideActivity). */
  activity?: SlideActivity
  title: string
  /** What's in it, in a sentence or two: the Slack agenda and the Run tab. Not on the shared screen once there are cards. */
  detail: string
  /** Planned minutes. Slides aren't timed: 0. */
  minutes: number
  /** The board posts this segment is about (the top topic, the clinic's problems): Kers' prep and "who to ask". */
  topicIds?: string[]
  /** One short line on top of the shared screen: what the room does now ("Vote first, then we read them."). */
  cue?: string
  /** The segment's real content (see Card). Missing: its topicIds as post cards, else its detail as text. */
  cards?: Card[]
  /** The presenter's notes: never on the shared screen, and only ever sent to the presenter. */
  prep?: Prep | null
}

export interface Note {
  id: string
  /** Which agenda segment it was taken in. */
  segment: string | null
  text: string
  owner: string | null
  decision: boolean
  at: string
}

export interface Meeting {
  cycleId: string
  meetUrl: string | null
  agenda: Segment[]
  notes: Note[]
  recordingUrl: string | null
  recap: string | null
  agendaPostedAt: string | null
  recapPostedAt: string | null
  startedAt: string | null
  endedAt: string | null
  /** Meeting mode (migration 045): who presents, and where the screen is. */
  presenterId: string | null
  currentSegment: string | null
  segmentStartedAt: string | null
  /** False until migration 045 is applied: the presenter screen then keeps its place locally. */
  presenterReady: boolean
  /**
   * The live rehearsal (migration 047, lib/meet/liveRehearsal.ts): its code
   * (admins only: the share link is `/meet?r=<code>`) and when it started.
   * Null when none is running. It never sets startedAt / endedAt.
   */
  rehearsalCode?: string | null
  rehearsalStartedAt?: string | null
  /** False until migration 047 is applied: "Rehearse live" then says so. */
  rehearsalReady?: boolean
  /** Whether Kers' first draft is kept, for the editor's "Reset to Kers draft" (migration 049). */
  hasDraft?: boolean
  /** False until migration 049 is applied: no draft is kept, and meme uploads are off. */
  draftReady?: boolean
}

/** What GET /api/admin/meeting returns: polled by the presenter screen, meeting mode and the board's card. */
export interface MeetingState {
  cycle: { id: string; label: string; meeting_at: string | null }
  meeting: Meeting
  /** The caller, so the screen knows whether it presents. */
  me: string
  presenterName: string | null
  /** The client corrects its clock by this (the poll reveal, Kers' Boss Round intro). */
  serverNow: string
  /** The audience (migration 046): who's in, the segment's activity and its answers. Null before 046. */
  room?: RoomState | null
}

/** Admins see the meeting card on the board (Rehearse, Start) from this long before: the day before. */
export const MEET_REHEARSE_MS = 24 * 3_600_000
/**
 * Inside this long before the meeting, "Start" just starts it; earlier, it
 * asks first (going live a day early by accident is the risk). It is also
 * the "3 h before at the latest" trigger for drafting Kers' prep.
 */
export const MEET_LEAD_MS = 3 * 3_600_000

/**
 * What to ask before starting a meeting that's still more than MEET_LEAD_MS
 * away, or null when it's close enough (or has no date) to just start.
 */
export function earlyStartWarning(meetingAt: string | null | undefined, now = Date.now()): string | null {
  if (!meetingAt) return null
  const at = new Date(meetingAt).getTime()
  if (!Number.isFinite(at) || at - now <= MEET_LEAD_MS) return null
  const day = new Date(at).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const today = new Date(now).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const tomorrow = new Date(now + 86_400_000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  const time = new Date(at).toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' })
  const when = day === today ? `today at ${time}` : day === tomorrow ? `tomorrow at ${time}` : `on ${new Date(at).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long' })} at ${time}`
  return `The meeting is ${when}. Start it now? Everyone will see the live banner.`
}
/** ...and until this long after its planned start, unless it was ended. */
export const MEET_TAIL_MS = 4 * 3_600_000
/** A meeting nobody ended stops counting as live after this long. */
export const MEET_LIVE_MAX_MS = 8 * 3_600_000

/**
 * Whether meeting mode is on: started, not ended, and not one left running
 * from long ago (a test start nobody ended). The one rule for the server,
 * /meet and the admin screens, so the presenter never sees "live" while the
 * room is shut.
 */
export function meetingLive(m: { startedAt: string | null; endedAt: string | null } | null | undefined, now = Date.now()): boolean {
  return !!m?.startedAt && !m.endedAt && now - new Date(m.startedAt).getTime() < MEET_LIVE_MAX_MS
}

/**
 * Whether this month's meeting has actually happened and ended. A test start
 * and End well before the meeting (more than MEET_LEAD_MS early) doesn't
 * count, so it can't hide the board card or the presenter's Start button.
 */
export function meetingDone(m: { startedAt: string | null; endedAt: string | null } | null | undefined, meetingAt: string | null | undefined): boolean {
  if (!m?.endedAt) return false
  const at = meetingAt ? new Date(meetingAt).getTime() : NaN
  if (!Number.isFinite(at) || !m.startedAt) return true
  return new Date(m.startedAt).getTime() >= at - MEET_LEAD_MS
}

/** After End, the board card offers "Reopen meeting" for this long (answers kept). */
export const REOPEN_MS = 3_600_000

/** Whether an ended meeting may still be reopened: it ended under REOPEN_MS ago. */
export function canReopen(m: { startedAt: string | null; endedAt: string | null } | null | undefined, now = Date.now()): boolean {
  if (!m?.startedAt || !m.endedAt) return false
  const ended = new Date(m.endedAt).getTime()
  return Number.isFinite(ended) && now - ended >= 0 && now - ended < REOPEN_MS
}

/**
 * A start and End that nobody joined and nobody answered: an accident
 * (Start, then End). It mustn't count as the meeting having run, so the
 * server resets it (started/ended cleared) and Start comes back.
 */
export function hollowRun(m: { startedAt: string | null; endedAt: string | null } | null | undefined, joined: number, answers: number): boolean {
  return !!m?.startedAt && !!m.endedAt && joined === 0 && answers === 0
}

/** Inside this long before the meeting (or once it's due), the Start sheet picks "Go live"; earlier, "Rehearse". */
export const GO_LIVE_WINDOW_MS = 30 * 60_000

/** The Start sheet's default: go live within 30 minutes of the meeting (or after its time), else rehearse. */
export function defaultStartMode(meetingAt: string | null | undefined, now = Date.now()): 'live' | 'rehearse' {
  if (!meetingAt) return 'live'
  const at = new Date(meetingAt).getTime()
  if (!Number.isFinite(at)) return 'live'
  return at - now <= GO_LIVE_WINDOW_MS ? 'live' : 'rehearse'
}

export const MEETING_MINUTES = 60
export const LIMITS = {
  title: 80, detail: 400, note: 300, owner: 60, recap: 4000, segments: 40, notes: 200, point: 200, opener: 240, points: 3, topics: 3,
  // Cue and cards: the shared screen fits six cards and a one-line cue at 1920 x 1080.
  cue: 120, cards: 6, cardTitle: 120, cardText: 180, source: 60, label: 40, url: 500, section: 40, memeText: 90, src: 200,
  // An activity's question and a poll's options (meeting_activities: prompt 1-200, options 2-4).
  prompt: 200, option: 80, options: 4, config: 4000,
} as const

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

/** Whatever the editor sent, cut down to a valid agenda. */
export function cleanAgenda(raw: unknown): Segment[] {
  if (!Array.isArray(raw)) return []
  const kinds = Object.keys(KIND_LABELS) as SegmentKind[]
  return raw.slice(0, LIMITS.segments).map((s, i) => {
    const r = (s ?? {}) as Record<string, unknown>
    const minutes = Math.round(Number(r.minutes))
    const topicIds = Array.isArray(r.topicIds) ? [...new Set(r.topicIds.filter((t): t is string => typeof t === 'string' && UUID.test(t)))].slice(0, LIMITS.topics) : []
    const slide = SLIDE_KINDS.includes(r.slide as SlideKind) ? (r.slide as SlideKind) : undefined
    const section = str(r.section, LIMITS.section)
    const of = slide === 'results' ? str(r.of, 40) : ''
    // Only an activity slide (or an old segment, which may have one) is timed.
    const duration = !slide || slide === 'activity' ? cleanDuration(r.duration_s) : undefined
    const meme = slide === 'meme' ? cleanMeme(r.meme) : null
    const activity = !slide || slide === 'activity' ? cleanActivity(r.activity) : null
    return {
      id: str(r.id, 40) || `seg-${i}`,
      kind: kinds.includes(r.kind as SegmentKind) ? (r.kind as SegmentKind) : 'custom',
      ...(slide ? { slide } : {}),
      ...(section ? { section } : {}),
      ...(of ? { of } : {}),
      ...(duration !== undefined ? { duration_s: duration } : {}),
      ...(meme ? { meme } : {}),
      ...(activity ? { activity } : {}),
      title: str(r.title, LIMITS.title) || (slide ? '' : 'Untitled'),
      detail: str(r.detail, LIMITS.detail),
      // Slides aren't timed: 0 is allowed for them.
      minutes: Number.isFinite(minutes) ? Math.min(60, Math.max(slide ? 0 : 1, minutes)) : slide ? 0 : 5,
      topicIds,
      ...(str(r.cue, LIMITS.cue) ? { cue: str(r.cue, LIMITS.cue) } : {}),
      ...(Array.isArray(r.cards) ? { cards: cleanCards(r.cards) } : {}),
      prep: cleanPrep(r.prep),
    }
  })
}

/**
 * An activity slide's activity as the editor sent it, cut down. Null when it
 * isn't one. An empty prompt or a poll short of options is kept (the editor
 * is mid-way): such an activity is just not written to meeting_activities
 * until it's complete (lib/meet/agendaEdit.ts activityComplete).
 */
export function cleanActivity(raw: unknown): SlideActivity | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const r = raw as Record<string, unknown>
  if (!ACTIVITY_KINDS.includes(r.kind as ActivityKind)) return null
  const kind = r.kind as ActivityKind
  const prompt = str(r.prompt, LIMITS.prompt)
  const options = kind === 'poll' && Array.isArray(r.options) ? r.options.slice(0, LIMITS.options).map(o => (typeof o === 'string' ? o.slice(0, LIMITS.option) : '')) : []
  const config = r.config && typeof r.config === 'object' && !Array.isArray(r.config) && JSON.stringify(r.config).length <= LIMITS.config ? (r.config as Record<string, unknown>) : null
  return { kind, prompt, ...(kind === 'poll' ? { options } : {}), ...(config && Object.keys(config).length ? { config } : {}) }
}

/** Where an uploaded meme lives: the public `meeting-memes` bucket (migration 049). */
export const MEME_BUCKET = 'meeting-memes'
const LOCAL_MEME = /^\/meet\/memes\/[\w.\-]+\.(png|jpe?g|gif|webp|svg)$/i
const UPLOADED_MEME = new RegExp(`^https://[a-z0-9-]+\\.supabase\\.co/storage/v1/object/public/${MEME_BUCKET}/[\\w.\\-]+\\.(png|jpe?g|gif|webp)$`, 'i')

/** Whether a meme image's src is one we serve: a file under /meet/memes/, or an upload in the meme bucket. */
export function memeSrcOk(src: string): boolean {
  return LOCAL_MEME.test(src) || UPLOADED_MEME.test(src)
}

/** A meme as the file or the editor sent it: an image (under /meet/memes/ or uploaded), or Kers panels. Null when empty. */
export function cleanMeme(raw: unknown): Meme | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const src = typeof r.src === 'string' && r.src.trim().length <= LIMITS.src && memeSrcOk(r.src.trim()) ? r.src.trim() : ''
  const panels = (Array.isArray(r.panels) ? r.panels : [])
    .map(p => {
      const q = (p ?? {}) as Record<string, unknown>
      const text = str(q.text, LIMITS.memeText)
      const face = MEME_FACES.includes(q.face as MemeFace) ? (q.face as MemeFace) : 'smug'
      return text ? { label: str(q.label, LIMITS.label), text, face } : null
    })
    .filter((p): p is NonNullable<typeof p> => !!p)
    .slice(0, 2)
  const caption = str(r.caption, LIMITS.memeText)
  const alt = str(r.alt, LIMITS.cardText)
  if (!src && !panels.length && !caption) return null
  return { ...(src ? { src, alt } : {}), ...(panels.length ? { panels } : {}), ...(caption ? { caption } : {}) }
}

/** A link a phone may open: http(s) only, else nothing. */
export function cleanUrl(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined
  const u = v.trim()
  if (u.length > LIMITS.url || !/^https?:\/\/[^\s]+$/i.test(u)) return undefined
  try {
    return new URL(u).protocol.startsWith('http') ? u : undefined
  } catch {
    return undefined
  }
}

/** One card as the editor, the file or the model sent it, cut down. Null when it isn't a card. */
export function cleanCard(raw: unknown): Card | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  switch (r.kind) {
    case 'news': {
      const title = str(r.title, LIMITS.cardTitle)
      if (!title) return null
      const url = cleanUrl(r.url)
      const from = r.from === 'member' || r.from === 'digest' ? r.from : undefined
      return { kind: 'news', title, source: str(r.source, LIMITS.source), ...(url ? { url } : {}), why: str(r.why, LIMITS.cardText), ...(from ? { from } : {}) }
    }
    case 'post':
      return typeof r.postId === 'string' && UUID.test(r.postId) ? { kind: 'post', postId: r.postId } : null
    case 'side': {
      const label = str(r.label, LIMITS.label)
      const text = str(r.text, LIMITS.cardText)
      return label && text ? { kind: 'side', label, text } : null
    }
    case 'note': {
      const title = str(r.title, LIMITS.cardTitle)
      if (!title) return null
      const text = str(r.text, LIMITS.cardText)
      return { kind: 'note', title, ...(text ? { text } : {}) }
    }
    default:
      return null
  }
}

export function cleanCards(raw: unknown): Card[] {
  return Array.isArray(raw) ? raw.map(cleanCard).filter((c): c is Card => !!c).slice(0, LIMITS.cards) : []
}

/**
 * What a segment shows: its cards, or for an agenda written before cards
 * existed, its board posts as post cards. Empty means the screen falls back
 * to the segment's detail.
 */
export function segmentCards(s: Pick<Segment, 'cards' | 'topicIds'>): Card[] {
  if (s.cards?.length) return s.cards
  return (s.topicIds ?? []).map(postId => ({ kind: 'post', postId }) as Card)
}

/** Every post a card or a segment points at, for one fetch. */
export function agendaPostIds(agenda: Pick<Segment, 'cards' | 'topicIds'>[]): string[] {
  return [...new Set(agenda.flatMap(s => [...(s.topicIds ?? []), ...segmentCards(s).flatMap(c => (c.kind === 'post' ? [c.postId] : []))]))]
}

/** The slide on the shared screen, as the live banner names it: its title, else its section's. Null when there's none. */
export function liveSlideTitle(storedAgenda: unknown, currentSegment: string | null | undefined): string | null {
  if (!currentSegment) return null
  const s = cleanAgenda(storedAgenda).find(x => x.id === currentSegment)
  return (s?.title || s?.section || '').trim() || null
}

/** A slide as every phone may see it: no prep, ever (the presenter's notes go separately, to them alone). */
export type PublicSegment = Pick<Segment, 'id' | 'kind' | 'title' | 'minutes' | 'slide' | 'section' | 'of' | 'meme'> & { cue: string | null; cards: Card[]; detail: string }

export function publicSegments(agenda: Segment[]): PublicSegment[] {
  return agenda.map(s => ({
    id: s.id,
    kind: s.kind,
    ...(s.slide ? { slide: s.slide } : {}),
    ...(s.section ? { section: s.section } : {}),
    ...(s.of ? { of: s.of } : {}),
    ...(s.meme ? { meme: s.meme } : {}),
    title: s.title,
    minutes: s.minutes,
    cue: s.cue ?? null,
    cards: segmentCards(s),
    detail: s.cards?.length || s.slide ? '' : s.detail,
  }))
}

type SlideLike = Pick<Segment, 'id' | 'slide' | 'of' | 'section' | 'title' | 'kind'>

/**
 * What a slide is, old segments included: an item without `slide` is an
 * old segment, shown as one `activity` slide when it has an activity, else
 * one `content` slide.
 */
export function slideKind(s: Pick<Segment, 'slide'>, hasActivity = false): SlideKind {
  return s.slide ?? (hasActivity ? 'activity' : 'content')
}

/**
 * The activity a slide is about, by the key meeting_activities stores it
 * under (its segment_id column): an activity slide's own id, a results
 * slide's `of`. Any other slide: its own id (an old segment's activity).
 */
export function activityKeyFor(agenda: Pick<Segment, 'id' | 'slide' | 'of'>[], slideId: string | null | undefined): string | null {
  if (!slideId) return null
  const s = agenda.find(x => x.id === slideId)
  return s?.slide === 'results' && s.of ? s.of : slideId
}

export interface Section {
  /** The section's name: `section`, else the first slide's title. */
  title: string
  kind: SegmentKind
  /** Index of its first slide in the agenda. */
  start: number
  slides: number
}

/** The agenda's sections: runs of consecutive slides with the same `section` (an old segment is its own). */
export function sectionsOf(agenda: SlideLike[]): Section[] {
  const out: Section[] = []
  agenda.forEach((s, i) => {
    const key = s.section ?? `#${s.id}`
    const last = out[out.length - 1]
    const lastKey = last ? agenda[last.start].section ?? `#${agenda[last.start].id}` : null
    if (last && lastKey === key) last.slides++
    else out.push({ title: s.section ?? s.title, kind: s.kind, start: i, slides: 1 })
  })
  return out
}

/**
 * The presenter's notes for their own phone: the opener and the talking
 * points per segment, and only when `viewerId` is who presents. Anyone else
 * (a member, a guest, another admin) gets null.
 */
export type PresenterNotes = Record<string, { opener: string; points: string[] }>

export function presenterNotes(agenda: Segment[], viewerId: string | null, presenterId: string | null | undefined): PresenterNotes | null {
  if (!viewerId || !presenterId || viewerId !== presenterId) return null
  return Object.fromEntries(agenda.filter(s => s.prep && (s.prep.opener || s.prep.points.length)).map(s => [s.id, { opener: s.prep!.opener, points: s.prep!.points }]))
}

/** A prep as the editor or the model sent it, cut down. Null when there's nothing in it. */
export function cleanPrep(raw: unknown): Prep | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const points = (Array.isArray(r.points) ? r.points : []).map(p => str(p, LIMITS.point)).filter(Boolean).slice(0, LIMITS.points)
  const opener = str(r.opener, LIMITS.opener)
  const by = r.by === 'admin' ? 'admin' : 'kers'
  // An admin who cleared it meant it: keep the empty prep so Kers doesn't refill it.
  if (!points.length && !opener && by !== 'admin') return null
  return { points, opener, by, at: typeof r.at === 'string' ? r.at : null }
}

export function cleanNote(raw: unknown): Omit<Note, 'id' | 'at'> | null {
  const r = (raw ?? {}) as Record<string, unknown>
  const text = str(r.text, LIMITS.note)
  if (!text) return null
  return { segment: str(r.segment, 40) || null, text, owner: str(r.owner, LIMITS.owner) || null, decision: r.decision === true }
}

export function totalMinutes(agenda: Segment[]): number {
  return agenda.reduce((n, s) => n + s.minutes, 0)
}

/**
 * What a phone gets of the agenda as stored (`ask` and all): every segment's
 * cue and cards, and the presenter's notes only if `viewerId` presents.
 */
export function phoneAgenda(stored: unknown, viewerId: string | null, presenterId: string | null | undefined): { agenda: PublicSegment[]; notes: PresenterNotes | null } {
  const agenda = cleanAgenda(stored)
  return { agenda: publicSegments(agenda), notes: presenterNotes(agenda, viewerId, presenterId) }
}

/**
 * A board post as a meeting card draws it: the fields the board's own card
 * shows (components/topics/TopicCard.tsx TopicCardFace), with the author as
 * the board shows it to everyone else: a ghost post keeps its ghost handle.
 */
export interface MeetPost {
  id: string
  title: string
  description: string
  category: string
  is_selected: boolean
  status: string
  author_username: string
  is_system: boolean
  created_at: string
  vote_count: number
  comment_count: number
}
