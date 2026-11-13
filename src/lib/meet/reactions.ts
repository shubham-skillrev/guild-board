/**
 * Live reactions (docs/08-meeting-mode-v2.md, Batch 4 extras, migration 051):
 * phones in /meet send 🔥 😂 👏; the server rate-limits each person, keeps a
 * count per person (meeting_reactions) and the room's totals ride the
 * existing `meeting:{cycle_id}` broadcast (RoomState.reactions). The shared
 * screen floats up the difference between two totals it has seen.
 *
 * Never stored in meeting_responses (the Boss Round uses its slots).
 * Pure, no imports: runs under `node --test`.
 */

export const REACTIONS = ['fire', 'laugh', 'clap'] as const
export type Reaction = (typeof REACTIONS)[number]
export const REACTION_EMOJI: Record<Reaction, string> = { fire: '🔥', laugh: '😂', clap: '👏' }
export const REACTION_LABEL: Record<Reaction, string> = { fire: 'Fire', laugh: 'Laugh', clap: 'Clap' }

/** One reaction per person this often; a faster tap is dropped quietly. */
export const REACT_GAP_MS = 1500
/** And at most this many per person per meeting. */
export const REACT_MAX = 60
/** The most floats one update may start per reaction (a burst after a missed broadcast stays calm). */
export const FLOAT_CAP = 6

export type ReactionTotals = Record<Reaction, number>

export function isReaction(v: unknown): v is Reaction {
  return typeof v === 'string' && (REACTIONS as readonly string[]).includes(v)
}

export function noReactions(): ReactionTotals {
  return { fire: 0, laugh: 0, clap: 0 }
}

const count = (v: unknown) => Math.max(0, Math.floor(Number(v) || 0))

/** Whether one more reaction from a person who sent `n` so far, the last at `last` (ms, 0 = never), goes through. */
export function reactionAllowed(n: number, last: number, now: number): boolean {
  return n < REACT_MAX && (!last || now - last >= REACT_GAP_MS)
}

/** How many a meeting_reactions row holds in all. */
export function reactionCount(row: Partial<Record<Reaction, unknown>> | null | undefined): number {
  return row ? REACTIONS.reduce((n, r) => n + count(row[r]), 0) : 0
}

/** The room's totals from every person's row. */
export function sumReactions(rows: Partial<Record<Reaction, unknown>>[]): ReactionTotals {
  const out = noReactions()
  for (const row of rows) for (const r of REACTIONS) out[r] += count(row[r])
  return out
}

/**
 * What to float after the totals moved from `prev` to `next`: each new
 * reaction once, at most FLOAT_CAP of a kind per update. Nothing on the first
 * sight (`prev` null: a page load isn't a burst) or when a total went down
 * (a rehearsal wiped).
 */
export function reactionBursts(prev: ReactionTotals | null | undefined, next: ReactionTotals | null | undefined, cap = FLOAT_CAP): Reaction[] {
  if (!prev || !next) return []
  const out: Reaction[] = []
  for (const r of REACTIONS) {
    const d = count(next[r]) - count(prev[r])
    for (let i = 0; i < Math.min(Math.max(0, d), cap); i++) out.push(r)
  }
  return out
}
