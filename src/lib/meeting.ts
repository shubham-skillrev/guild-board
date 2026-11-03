/**
 * The monthly meeting: its agenda, the notes taken live, and the recap.
 * Shapes shared by the Run tab, meeting mode and the API (migration 041).
 */

export type SegmentKind = 'radar' | 'showtell' | 'topic' | 'clinic' | 'wrap' | 'custom'

export interface Segment {
  id: string
  kind: SegmentKind
  title: string
  /** What's in it: the Radar's three links, who's demoing, the topic. */
  detail: string
  minutes: number
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
}

export const MEETING_MINUTES = 60
export const LIMITS = { title: 80, detail: 400, note: 300, owner: 60, recap: 4000, segments: 12, notes: 200 } as const

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : ''
}

/** Whatever the editor sent, cut down to a valid agenda. */
export function cleanAgenda(raw: unknown): Segment[] {
  if (!Array.isArray(raw)) return []
  const kinds: SegmentKind[] = ['radar', 'showtell', 'topic', 'clinic', 'wrap', 'custom']
  return raw.slice(0, LIMITS.segments).map((s, i) => {
    const r = (s ?? {}) as Record<string, unknown>
    const minutes = Math.round(Number(r.minutes))
    return {
      id: str(r.id, 40) || `seg-${i}`,
      kind: kinds.includes(r.kind as SegmentKind) ? (r.kind as SegmentKind) : 'custom',
      title: str(r.title, LIMITS.title) || 'Untitled',
      detail: str(r.detail, LIMITS.detail),
      minutes: Number.isFinite(minutes) ? Math.min(60, Math.max(1, minutes)) : 5,
    }
  })
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
