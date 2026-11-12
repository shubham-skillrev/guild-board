import type { RoomState } from '@/lib/meet/activity'

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
 * What a segment shows, as cards (docs/06-meeting-mode.md, "Cue and cards"):
 * on the shared screen under the cue, and on every phone between activities.
 * Public: nothing here may name anyone the board doesn't already name.
 *
 *   news  a Radar item: its title, where it's from, the link (phones open
 *         it), and one line on why it matters
 *   post  a board post, drawn with the board's own card (fetched server-side,
 *         ghost posts keep their ghost handle)
 *   slot  a Show & Tell slot: "Spotlight", invited / confirmed / open, and an
 *         optional line (never a name the board doesn't show)
 *   side  one side of the Topic's debate, with its one-liner
 *   note  anything else, short: a title and an optional line
 */
export type Card =
  | { kind: 'news'; title: string; source: string; url?: string; why: string; from?: 'member' | 'digest' }
  | { kind: 'post'; postId: string }
  | { kind: 'slot'; label: string; status: SlotStatus; text?: string }
  | { kind: 'side'; label: string; text: string }
  | { kind: 'note'; title: string; text?: string }

export type CardKind = Card['kind']
export type SlotStatus = 'invited' | 'confirmed' | 'open'

export interface Segment {
  id: string
  kind: SegmentKind
  title: string
  /** What's in it, in a sentence or two: the Slack agenda and the Run tab. Not on the shared screen once there are cards. */
  detail: string
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

export const MEETING_MINUTES = 60
export const LIMITS = {
  title: 80, detail: 400, note: 300, owner: 60, recap: 4000, segments: 12, notes: 200, point: 200, opener: 240, points: 3, topics: 3,
  // Cue and cards: the shared screen fits six cards and a one-line cue at 1920 x 1080.
  cue: 120, cards: 6, cardTitle: 120, cardText: 180, source: 60, label: 40, url: 500,
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
    return {
      id: str(r.id, 40) || `seg-${i}`,
      kind: kinds.includes(r.kind as SegmentKind) ? (r.kind as SegmentKind) : 'custom',
      title: str(r.title, LIMITS.title) || 'Untitled',
      detail: str(r.detail, LIMITS.detail),
      minutes: Number.isFinite(minutes) ? Math.min(60, Math.max(1, minutes)) : 5,
      topicIds,
      ...(str(r.cue, LIMITS.cue) ? { cue: str(r.cue, LIMITS.cue) } : {}),
      ...(Array.isArray(r.cards) ? { cards: cleanCards(r.cards) } : {}),
      prep: cleanPrep(r.prep),
    }
  })
}

const SLOT_STATUSES: SlotStatus[] = ['invited', 'confirmed', 'open']

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
    case 'slot': {
      const label = str(r.label, LIMITS.label)
      if (!label) return null
      const text = str(r.text, LIMITS.cardText)
      return { kind: 'slot', label, status: SLOT_STATUSES.includes(r.status as SlotStatus) ? (r.status as SlotStatus) : 'open', ...(text ? { text } : {}) }
    }
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

/** A segment as every phone may see it: no prep, ever (the presenter's notes go separately, to them alone). */
export type PublicSegment = Pick<Segment, 'id' | 'kind' | 'title' | 'minutes'> & { cue: string | null; cards: Card[]; detail: string }

export function publicSegments(agenda: Segment[]): PublicSegment[] {
  return agenda.map(s => ({ id: s.id, kind: s.kind, title: s.title, minutes: s.minutes, cue: s.cue ?? null, cards: segmentCards(s), detail: s.cards?.length ? '' : s.detail }))
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
