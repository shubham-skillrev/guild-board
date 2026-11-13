/**
 * The ask-anything queue (docs/08-meeting-mode-v2.md, Batch 4 extras,
 * migration 051): anyone in the room (members and guests) sends an
 * anonymous question from /meet and upvotes others' (one vote per person per
 * question). The presenter sees them sorted by votes, pulls one onto the
 * shared screen, and marks it answered.
 *
 *   anonymous   nobody is ever shown who asked or who voted: the queue is
 *               text and counts (RoomState.questions); a phone learns only
 *               which ones it upvoted itself (MeetView.voted)
 *   filtered    Kers' profanity filter (./profanity.ts), a quiet drop
 *   limited     at most ASK_MAX per person per meeting, one per ASK_GAP_MS
 *
 * Pure, imports by path only: runs under `node --test`.
 */

import { isBlocked } from './profanity.ts'

export const QUESTION_MAX = 200
export const QUESTION_MIN = 3
/** One question per person this often. */
export const ASK_GAP_MS = 20_000
/** And at most this many per person per meeting. */
export const ASK_MAX = 5
/** The most questions the broadcast carries (the top of the queue). */
export const QUEUE_SHOWN = 40

/** A question as everyone may see it. */
export interface PublicQuestion {
  id: string
  text: string
  votes: number
  answered: boolean
  /** When it was asked (ties go to the older). */
  at: string
}

/** A question as typed: one line of plain text, single spaces, at most QUESTION_MAX characters. Null if too short. */
export function cleanQuestion(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const t = raw.normalize('NFKC').replace(/[\p{C}]/gu, ' ').replace(/\s+/g, ' ').trim()
  const cut = [...t].slice(0, QUESTION_MAX).join('').trim()
  return [...cut].length >= QUESTION_MIN ? cut : null
}

export type Checked = { ok: true; text: string } | { ok: false; blocked?: boolean; error: string }

/** A question as sent, cleaned and filtered (checked as typed too: cleaning keeps "$" but Kers reads leetspeak either way). */
export function checkQuestion(raw: unknown): Checked {
  const text = cleanQuestion(raw)
  if (!text) return { ok: false, error: 'Type a question first.' }
  if (isBlocked(text) || (typeof raw === 'string' && isBlocked(raw.slice(0, QUESTION_MAX * 2)))) return { ok: false, blocked: true, error: 'Kers didn’t like that one' }
  return { ok: true, text }
}

/**
 * Whether one more question from a person who asked at `times` (ms) goes
 * through now: null if it does, else what to tell them.
 */
export function askRefusal(times: number[], now: number): string | null {
  if (times.length >= ASK_MAX) return `That’s your ${ASK_MAX}. Upvote the others.`
  const last = times.length ? Math.max(...times) : 0
  if (last && now - last < ASK_GAP_MS) return `One question every ${Math.round(ASK_GAP_MS / 1000)} seconds.`
  return null
}

/** What a vote tap does: add the vote, take it back, or nothing (an answered question takes no new votes). */
export function voteChange(voted: boolean, want: boolean, answered: boolean): 'add' | 'remove' | 'none' {
  if (want === voted) return 'none'
  if (want) return answered ? 'none' : 'add'
  return 'remove'
}

/** The queue's order: still open first, then most votes, then the oldest. */
export function sortQueue<T extends Pick<PublicQuestion, 'votes' | 'answered' | 'at'>>(qs: T[]): T[] {
  return [...qs].sort((a, b) => Number(a.answered) - Number(b.answered) || b.votes - a.votes || a.at.localeCompare(b.at))
}

/** meeting_questions rows (with their vote count) as the room shows them: sorted, the top QUEUE_SHOWN. */
export function buildQueue(rows: { id: string; body: string; created_at: string; answered_at: string | null; votes: number }[]): PublicQuestion[] {
  return sortQueue(rows.map(r => ({ id: r.id, text: r.body, votes: Math.max(0, Math.floor(r.votes || 0)), answered: !!r.answered_at, at: r.created_at }))).slice(0, QUEUE_SHOWN)
}

/** How many are still waiting. */
export function openCount(qs: Pick<PublicQuestion, 'answered'>[] | null | undefined): number {
  return (qs ?? []).filter(q => !q.answered).length
}

/** The solo preview's queue: a couple of what a room might ask, clearly samples. */
export const SAMPLE_QUESTIONS: PublicQuestion[] = [
  { id: 'sample-q1', text: 'How do we pick which topics make the agenda?', votes: 4, answered: false, at: '2026-01-01T10:00:00.000Z' },
  { id: 'sample-q2', text: 'Can we get the Boss Round problems ahead of time to practise?', votes: 2, answered: false, at: '2026-01-01T10:01:00.000Z' },
  { id: 'sample-q3', text: 'Will the slides be shared after?', votes: 1, answered: true, at: '2026-01-01T10:02:00.000Z' },
]
