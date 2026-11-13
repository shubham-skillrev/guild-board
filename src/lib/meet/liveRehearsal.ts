/**
 * The live rehearsal (docs/06-meeting-mode.md, "Rehearsal", migration 047):
 * the real pipeline (join, answer, broadcast, slides opening and closing
 * their activities) the day before, for the admin and the few people they
 * share a link with. Private, marked, disposable:
 *
 *   private     `started_at` is never touched, so the meeting isn't live:
 *               no banner, /api/meet/live says no. /meet lets in only those
 *               holding the code (`/meet?r=<code>`; the proxy keeps it in the
 *               `gb_meet_r` cookie)
 *   marked      the presenter screen and the phones say "Rehearsal"
 *   disposable  ending it (or starting the real meeting) deletes every
 *               participant and answer of the month, resets every activity
 *               to `ready` and clears the presenter, the slide and the code
 *
 * It can't start while the real meeting is live or once it has run (the
 * wipe would take real answers with it); starting the real meeting ends it.
 *
 * Pure, imports by path only: runs under `node --test`, and the proxy and
 * client components may import it.
 */

import { MEET_LEAD_MS, MEET_LIVE_MAX_MS, meetingLive } from '../meeting.ts'

/** Where the proxy keeps the code from `/meet?r=<code>`. httpOnly. */
export const REHEARSAL_COOKIE = 'gb_meet_r'
/** A rehearsal outlives no evening. */
export const REHEARSAL_COOKIE_MAX_AGE = 12 * 3600
/** What a code looks like (newRehearsalCode makes 32 of these). Anything else is ignored. */
export const REHEARSAL_CODE_RE = /^[A-Za-z0-9_-]{20,64}$/

export interface RehearsalFields {
  startedAt: string | null
  endedAt: string | null
  rehearsalCode?: string | null
  rehearsalStartedAt?: string | null
}

/** A fresh, unguessable code: 24 random bytes, base64url (192 bits). */
export function newRehearsalCode(): string {
  const bytes = new Uint8Array(24)
  globalThis.crypto.getRandomValues(bytes)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/** The share link's path. */
export function rehearsalPath(code: string): string {
  return `/meet?r=${encodeURIComponent(code)}`
}

/** Whether a rehearsal is running: a code, a start, and not left running from long ago. */
export function rehearsalOn(m: Pick<RehearsalFields, 'rehearsalCode' | 'rehearsalStartedAt'> | null | undefined, now = Date.now()): boolean {
  if (!m?.rehearsalCode || !m.rehearsalStartedAt) return false
  const t = new Date(m.rehearsalStartedAt).getTime()
  return Number.isFinite(t) && now - t < MEET_LIVE_MAX_MS
}

/** Whether a rehearsal was ever left behind (running or stale): its code is still stored. */
export function rehearsalLeft(m: Pick<RehearsalFields, 'rehearsalCode' | 'rehearsalStartedAt'> | null | undefined): boolean {
  return !!(m?.rehearsalCode || m?.rehearsalStartedAt)
}

function sameString(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let d = 0
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return d === 0
}

/** Whether `code` (the cookie) lets this person into the running rehearsal. */
export function rehearsalAccess(m: Pick<RehearsalFields, 'rehearsalCode' | 'rehearsalStartedAt'> | null | undefined, code: string | null | undefined, now = Date.now()): boolean {
  if (!rehearsalOn(m, now) || typeof code !== 'string' || !REHEARSAL_CODE_RE.test(code)) return false
  return sameString(code, m!.rehearsalCode!)
}

/**
 * Whether the real meeting has actually run this month (started inside the
 * MEET_LEAD_MS before its time, or at any time when it has no date). An
 * early dry-run start doesn't count (the same rule as meetingDone).
 */
export function realMeetingRan(m: Pick<RehearsalFields, 'startedAt'>, meetingAt: string | null | undefined): boolean {
  if (!m.startedAt) return false
  const at = meetingAt ? new Date(meetingAt).getTime() : NaN
  if (!Number.isFinite(at)) return true
  return new Date(m.startedAt).getTime() >= at - MEET_LEAD_MS
}

/** A `meetings` row as the room reads it (snake case, straight from the database). */
export interface MeetingRowLike {
  started_at: string | null
  ended_at: string | null
  rehearsal_code?: string | null
  rehearsal_started_at?: string | null
}

const fromRow = (m: MeetingRowLike | null | undefined) => (m ? { rehearsalCode: m.rehearsal_code, rehearsalStartedAt: m.rehearsal_started_at } : null)

/** A live rehearsal is running in this row (never `live`: no banner, no public join). */
export function rowRehearsing(m: MeetingRowLike | null | undefined, now = Date.now()): boolean {
  return rehearsalOn(fromRow(m), now)
}

/**
 * Whether a request may use the room (join, answer, see the slides): the
 * meeting is live, or a rehearsal is and `code` (the gb_meet_r cookie) is its
 * code. Everyone else finds it shut.
 */
export function roomOpenTo(m: MeetingRowLike | null | undefined, code: string | null | undefined, now = Date.now()): boolean {
  if (meetingLive(m ? { startedAt: m.started_at, endedAt: m.ended_at } : null, now)) return true
  return rehearsalAccess(fromRow(m), code, now)
}

/** Why a rehearsal can't start now, or null when it can. */
export function rehearsalBlocked(m: RehearsalFields, meetingAt: string | null | undefined, now = Date.now()): string | null {
  if (meetingLive(m, now)) return 'The meeting is live. No rehearsal now.'
  if (realMeetingRan(m, meetingAt)) return 'This month’s meeting has already run.'
  return null
}

/**
 * How much ending a rehearsal may wipe. `all`: every participant and answer
 * of the month, the activities back to ready, the presenter, slide and
 * started/ended (only ever a dry run's here). `code`: only the rehearsal's
 * own columns, when the real meeting is live or has run (never touch it).
 */
export function rehearsalWipeMode(m: RehearsalFields, meetingAt: string | null | undefined, now = Date.now()): 'all' | 'code' {
  return rehearsalBlocked(m, meetingAt, now) ? 'code' : 'all'
}

// ─── The wipe ──────────────────────────────────────────────────────────────

type DbError = { message: string; code?: string } | null
/** The few query-builder calls the wipe makes (a Supabase client fits). */
interface Chain extends PromiseLike<{ error: DbError }> {
  eq(column: string, value: unknown): Chain
}
interface Table {
  update(patch: Record<string, unknown>): Chain
  delete(): Chain
}
export interface WipeDb {
  from(table: string): unknown
}

/**
 * End the rehearsal. The code goes first, so nobody joins mid-wipe; then
 * (`all`) the participants (their answers cascade), every activity back to
 * `ready`, and the presenter, slide and started/ended. Returns the first
 * error, if any; missing 046 tables are nothing to wipe.
 */
export async function wipeRehearsal(db: WipeDb, cycleId: string, mode: 'all' | 'code'): Promise<DbError> {
  const t = (name: string) => db.from(name) as Table
  const code = await t('meetings').update({ rehearsal_code: null, rehearsal_started_at: null }).eq('cycle_id', cycleId)
  if (code.error) return code.error
  if (mode === 'code') return null
  const errors: DbError[] = []
  const people = await t('meeting_participants').delete().eq('cycle_id', cycleId)
  errors.push(people.error)
  // Their questions, votes and reactions cascade with them (migration 051); the questions go explicitly too.
  const qs = await t('meeting_questions').delete().eq('cycle_id', cycleId)
  errors.push(qs.error)
  // Every activity back to ready, its hidden cloud words cleared (051; before it, without the column).
  let acts = await t('meeting_activities').update({ status: 'ready', opened_at: null, closed_at: null, hidden_words: [] }).eq('cycle_id', cycleId)
  if (acts.error && /hidden_words/.test(acts.error.message)) acts = await t('meeting_activities').update({ status: 'ready', opened_at: null, closed_at: null }).eq('cycle_id', cycleId)
  errors.push(acts.error)
  let meeting = await t('meetings').update({ presenter_id: null, current_segment: null, segment_started_at: null, started_at: null, ended_at: null }).eq('cycle_id', cycleId)
  // Before 045 there's no presenter to clear.
  if (meeting.error && /presenter_id|current_segment|segment_started_at/.test(meeting.error.message)) meeting = await t('meetings').update({ started_at: null, ended_at: null }).eq('cycle_id', cycleId)
  errors.push(meeting.error)
  return errors.find(e => e && !/meeting_(participants|activities|questions)/.test(e.message) && e.code !== '42P01' && e.code !== 'PGRST205') ?? null
}

/** Whether an error only means migration 047 isn't applied. */
export function missing047(error: { message?: string } | null | undefined): boolean {
  return !!error && /rehearsal_code|rehearsal_started_at/.test(error.message ?? '')
}
