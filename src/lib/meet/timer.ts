/**
 * The countdown ring (docs/08-meeting-mode-v2.md, Batch 2): every activity
 * slide runs for a set time, then closes on its own.
 *
 *   duration   per activity slide, `duration_s` on its agenda item (the
 *              slide editor sets it); missing: the kind's default (poll and
 *              word cloud 2:10; the Boss Round's stages, each its own
 *              activity slide (Batch 4): predict 1:00, fill 1:30, write 5:00)
 *   closes_at  stored on the meeting_activities row when it opens (migration
 *              048). The server is the source of truth: clients only draw it,
 *              corrected by their clock skew, and once it has passed the
 *              server closes the activity on its next read, whoever asks
 *   +30 s      the presenter extends it (from now, if it already ran out)
 *
 * Pure, imports by path only: runs under `node --test`, and client
 * components may import it.
 */

import type { ActivityKind } from './activity.ts'

/** Each kind's time when its slide doesn't set one, in seconds. */
export const DEFAULT_DURATION_S: Record<ActivityKind, number> = { poll: 130, cloud: 130, boss: 300, predict: 60, fill: 90 }
/** What the editor allows. */
export const MIN_DURATION_S = 10
export const MAX_DURATION_S = 30 * 60
/** The presenter's "+30s". */
export const EXTEND_S = 30
/** Extending never pushes the close further than this from now. */
export const MAX_LEFT_S = MAX_DURATION_S
/** An answer that left the phone just before zero still counts if it lands this soon after. */
export const ANSWER_GRACE_MS = 1000
/** The ring warms (yellow, then red) over this last share of its time. */
export const WARN_FRACTION = 0.2

/** A slide's `duration_s` as stored or sent: whole seconds in range, else undefined (the default applies). */
export function cleanDuration(raw: unknown): number | undefined {
  const n = typeof raw === 'string' && raw.trim() ? Number(raw) : raw
  if (typeof n !== 'number' || !Number.isFinite(n)) return undefined
  return Math.min(MAX_DURATION_S, Math.max(MIN_DURATION_S, Math.round(n)))
}

/** How long an activity runs: its slide's own time, else its kind's default. */
export function durationFor(kind: ActivityKind, slide?: { duration_s?: unknown } | null): number {
  return cleanDuration(slide?.duration_s) ?? DEFAULT_DURATION_S[kind] ?? DEFAULT_DURATION_S.poll
}

const ms = (iso: string | null | undefined): number => (iso ? new Date(iso).getTime() : NaN)

/** When an activity opened at `openedAt` (ms) for `durationS` closes. */
export function closesAtFor(openedAt: number, durationS: number): string {
  return new Date(openedAt + durationS * 1000).toISOString()
}

/** Milliseconds left, never below 0. Null when the activity isn't timed. */
export function remainingMs(closesAt: string | null | undefined, now: number): number | null {
  const end = ms(closesAt)
  return Number.isFinite(end) ? Math.max(0, end - now) : null
}

/** Whether a timed activity's time is up (an untimed one never is). */
export function expired(closesAt: string | null | undefined, now: number): boolean {
  const end = ms(closesAt)
  return Number.isFinite(end) && now >= end
}

/** Whether an answer arriving at `now` is too late (a second's grace for the network). */
export function tooLate(closesAt: string | null | undefined, now: number): boolean {
  const end = ms(closesAt)
  return Number.isFinite(end) && now >= end + ANSWER_GRACE_MS
}

/**
 * "+30s": the new close time. From the current close time, or from now if
 * that has already passed; never more than MAX_LEFT_S from now. Null when
 * the activity isn't timed (nothing to extend).
 */
export function extendClosesAt(closesAt: string | null | undefined, now: number, by = EXTEND_S): string | null {
  const end = ms(closesAt)
  if (!Number.isFinite(end)) return null
  return new Date(Math.min(Math.max(end, now) + by * 1000, now + MAX_LEFT_S * 1000)).toISOString()
}

/** The ring's whole length: opened to closes (grows with +30s). */
export function totalMs(openedAt: string | null | undefined, closesAt: string | null | undefined): number | null {
  const a = ms(openedAt)
  const b = ms(closesAt)
  return Number.isFinite(a) && Number.isFinite(b) && b > a ? b - a : null
}

/** How much of the ring is left, 0..1 (1 when it can't tell). */
export function fractionLeft(left: number, total: number | null): number {
  if (!total || total <= 0) return 1
  return Math.max(0, Math.min(1, left / total))
}

export type RingStage = 'calm' | 'warn' | 'end'

/** The ring's colour stage: calm, then yellow (`warn`) over the last 20%, red (`end`) once it's done. */
export function ringStage(left: number, total: number | null): RingStage {
  if (left <= 0) return 'end'
  return fractionLeft(left, total) <= WARN_FRACTION ? 'warn' : 'calm'
}

/** How far yellow has turned red, 0..1: 0 until the last 20%, then rising to 1 at zero. */
export function ringHeat(left: number, total: number | null): number {
  const f = fractionLeft(left, total)
  if (left <= 0) return 1
  return f > WARN_FRACTION ? 0 : 1 - f / WARN_FRACTION
}

/** m:ss, rounding up (so 0:00 shows only at zero). */
export function formatClock(left: number): string {
  const s = Math.max(0, Math.ceil(left / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** How far the server's clock is ahead of this one, from a time the server just sent. */
export function clockSkew(serverIso: string | null | undefined, clientNow: number): number {
  const t = ms(serverIso)
  return Number.isFinite(t) ? t - clientNow : 0
}

/** Open activities whose time is up: the server closes these on its next read. */
export function dueToClose<T extends { status: string; closes_at?: string | null }>(rows: T[], now: number): T[] {
  return rows.filter(r => r.status === 'open' && expired(r.closes_at, now))
}

/** Whether an error only means migration 048 (closes_at) isn't applied. */
export function missing048(error: { message?: string } | null | undefined): boolean {
  return !!error && /closes_at/.test(error.message ?? '')
}
