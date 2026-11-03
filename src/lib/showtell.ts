/**
 * Show & Tell: the two ten-minute slots in every guild meeting.
 *
 *   Spotlight  someone the guild nominated, invited by an organiser. An
 *              honour with a way out: two passes a year, then smaller formats
 *              are offered instead, never an order.
 *   Demo       anyone who volunteers to show something.
 *
 * Shared by the board, the API and the admin pages (migration 040's CHECKs
 * use the same values: change both together).
 */

export const DEMO_FORMATS = [
  { value: 'demo', label: 'Live demo', hint: 'Show it working, ~10 minutes' },
  { value: 'talk', label: 'Short talk', hint: 'What you learned, no slides needed' },
  { value: 'lightning', label: 'Lightning', hint: 'Three minutes, one idea' },
  { value: 'pair', label: 'Pair up', hint: 'Present with someone else' },
  { value: 'recorded', label: 'Recorded clip', hint: 'Record it, we play it' },
] as const

export type DemoFormat = (typeof DEMO_FORMATS)[number]['value']
export type DemoKind = 'spotlight' | 'demo'
export type DemoStatus = 'invited' | 'proposed' | 'confirmed' | 'passed' | 'done' | 'cancelled'

/** Offered once someone's passes for the year are used up. */
export const SMALL_FORMATS: DemoFormat[] = ['lightning', 'pair', 'recorded']

export const PASSES_PER_YEAR = 2

export const LIMITS = { title: 100, blurb: 280, note: 280 } as const

export function formatLabel(value: string | null | undefined): string {
  return DEMO_FORMATS.find(f => f.value === value)?.label ?? 'Live demo'
}

export function isFormat(value: unknown): value is DemoFormat {
  return DEMO_FORMATS.some(f => f.value === value)
}

/** A booked slot as anyone in the guild may see it. */
export interface Slot {
  id: string
  kind: DemoKind
  format: DemoFormat
  title: string | null
  blurb: string | null
  username: string
}

/** One of the viewer's own demos or invitations. */
export interface MyDemo {
  id: string
  kind: DemoKind
  status: DemoStatus
  format: DemoFormat
  title: string | null
  blurb: string | null
  note: string | null
  cycle_label: string | null
}
