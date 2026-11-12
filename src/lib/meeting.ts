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

export interface Segment {
  id: string
  kind: SegmentKind
  title: string
  /** What's in it: the Radar's three links, who's demoing, the topic. */
  detail: string
  minutes: number
  /** The board posts this segment is about (the top topic, the clinic's problems). */
  topicIds?: string[]
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
  /** For the countdown: the client corrects its clock by this. */
  serverNow: string
  /** The audience (migration 046): who's in, the segment's activity and its answers. Null before 046. */
  room?: RoomState | null
}

/** Admins see "Start meeting mode" on the board from this long before the meeting. */
export const MEET_LEAD_MS = 3 * 3_600_000
/** ...and until this long after its planned start, unless it was ended. */
export const MEET_TAIL_MS = 4 * 3_600_000

export const MEETING_MINUTES = 60
export const LIMITS = { title: 80, detail: 400, note: 300, owner: 60, recap: 4000, segments: 12, notes: 200, point: 200, opener: 240, points: 3, topics: 3 } as const

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
      prep: cleanPrep(r.prep),
    }
  })
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

/** Where the meeting is, as a fraction of the planned minutes (0..1). */
export function agendaProgress(agenda: Segment[], index: number, secondsIntoSegment: number): number {
  const total = totalMinutes(agenda)
  if (!total || index < 0) return 0
  const before = agenda.slice(0, index).reduce((n, s) => n + s.minutes, 0)
  const seg = agenda[index]
  const within = seg ? Math.min(seg.minutes, Math.max(0, secondsIntoSegment / 60)) : 0
  return Math.min(1, (before + within) / total)
}

/** m:ss for a countdown (sign shown by the caller). */
export function clock(seconds: number): string {
  const s = Math.abs(Math.round(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
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
