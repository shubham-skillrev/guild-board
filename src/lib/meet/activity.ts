/**
 * Meeting mode's audience activities (docs/06-meeting-mode.md, migration 046):
 * the shapes shared by /meet, the presenter screen and the API, how an answer
 * is cleaned, and how a room's answers become what the shared screen shows.
 *
 * Everything here switches on the activity's kind; each kind has a phone
 * renderer (components/meet/PhoneActivity.tsx) and a presenter renderer
 * (components/meet/ActivityPanel.tsx). The Boss Round's problems live in
 * ./boss.ts.
 *
 * Imports only ./boss.ts, by path, so the unit tests run it straight under
 * `node --test`.
 */

import { bossProblem } from './boss.ts'

export type ActivityKind = 'poll' | 'cloud' | 'boss'
export type ActivityStatus = 'ready' | 'open' | 'closed'

/** The presenter screen hides poll counts this long after a poll opens. */
export const POLL_REVEAL_MS = 8000
export const CLOUD_MAX_WORDS = 3
export const CLOUD_WORD_MAX = 20
/** The most words the cloud shows (and the broadcast carries). */
export const CLOUD_SHOWN = 60
export const BLOCKED_MESSAGE = 'Kers didn’t like that one'

/** A meeting_activities row. */
export interface ActivityRow {
  id: string
  cycle_id: string
  segment_id: string
  kind: ActivityKind
  prompt: string
  options: unknown
  config: unknown
  status: ActivityStatus
  opened_at: string | null
  closed_at: string | null
}

/** A meeting_responses row, as aggregate() needs it. */
export interface ResponseRow {
  participant_id: string
  slot: number
  value: unknown
}

/**
 * An activity as everyone may see it: the prompt and the room's answers in
 * aggregate. Never who answered what. This is the broadcast payload's core.
 */
export interface PublicActivity {
  id: string
  segmentId: string
  kind: ActivityKind
  prompt: string
  options: string[]
  /** Kind-specific setup (the Boss Round's problem, Phase 3). */
  config: Record<string, unknown>
  status: ActivityStatus
  openedAt: string | null
  closedAt: string | null
  /** People who answered at all. */
  answered: number
  /** Answers in total (cloud: words; poll: votes). */
  total: number
  /** poll: votes per option, in option order. */
  counts: number[] | null
  /** cloud: merged words, most typed first, at most CLOUD_SHOWN. */
  words: { word: string; n: number }[] | null
  /** boss: people whose latest run passed every test, people who ran at all, and passed as a floored % of trying. */
  tally: Record<string, number> | null
}

/** The room: what /meet, the presenter screen and the `meeting:{id}` broadcast share. */
export interface RoomState {
  cycleId: string
  live: boolean
  /** How many joined. */
  participants: number
  /** The segment on the shared screen. */
  segment: string | null
  /** The open activity, else the current segment's (ready or closed), else null. */
  activity: PublicActivity | null
  /** Whether any activity has opened yet: before that, /meet is the waiting area. */
  warm: boolean
  /** Server time, for the 8 s poll reveal. */
  at: string
}

/** What this participant has answered on the open activity, slot by slot. */
export interface Mine {
  activityId: string
  values: Record<string, unknown>[]
}

/** Everything /meet shows one person (GET /api/meet). */
export interface MeetView {
  cycleId: string | null
  label: string | null
  /** False until migration 046 is applied. */
  ready: boolean
  room: RoomState | null
  /** Signed in: their handle. They join with their account. */
  member: string | null
  /** Joined, and as whom. A guest's name is shown only on their own phone. */
  joined: { kind: 'member' | 'guest'; name: string | null } | null
  /** Their answers to the open activity. */
  mine: Mine | null
}

/** Whatever the presenter or the seed stored as options, as strings. */
export function optionsOf(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((o): o is string => typeof o === 'string').slice(0, 4) : []
}

function objectOf(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {}
}

/**
 * A word-cloud entry as it's merged and shown: lower-cased, letters, digits,
 * spaces and `' + # . -` only (so "c++" and "node.js" survive), single
 * spaces, no punctuation at the ends, at most 20 characters. Null if
 * nothing is left.
 */
export function cleanWord(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const w = raw
    .normalize('NFKC')
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\p{N} '+#.\-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[.'\-]+|[.'\-]+$/g, '')
    .trim()
  const cut = [...w].slice(0, CLOUD_WORD_MAX).join('').trim()
  return cut || null
}

export type Cleaned = { ok: true; value: Record<string, unknown> } | { ok: false; error: string }

/** An answer as sent by a phone, checked against its activity. Profanity is checked by the caller. */
export function cleanResponse(activity: Pick<ActivityRow, 'kind' | 'options'> & { config?: unknown }, raw: unknown): Cleaned {
  const r = objectOf(raw)
  switch (activity.kind) {
    case 'poll': {
      const option = Number(r.option)
      const n = optionsOf(activity.options).length
      return Number.isInteger(option) && option >= 0 && option < n ? { ok: true, value: { option } } : { ok: false, error: 'Pick one of the options.' }
    }
    case 'cloud': {
      const word = cleanWord(r.word)
      return word ? { ok: true, value: { word } } : { ok: false, error: 'Type a word first.' }
    }
    case 'boss': {
      // A run's result only, never the code: { passed, tests, of }.
      const problem = bossProblem(activity.config)
      if (!problem) return { ok: false, error: 'This Boss Round has no problem set.' }
      const tests = Number(r.tests)
      const of = Number(r.of)
      const fits = Number.isInteger(tests) && of === problem.cases.length && tests >= 0 && tests <= of
      if (!fits || typeof r.passed !== 'boolean' || r.passed !== (tests === of)) return { ok: false, error: 'That result doesn’t add up. Run the tests again.' }
      return { ok: true, value: { passed: r.passed, tests, of } }
    }
  }
}

/** The room's answers to one activity, as the shared screen shows them. */
export function aggregate(activity: ActivityRow, rows: ResponseRow[]): PublicActivity {
  const options = optionsOf(activity.options)
  const people = new Set(rows.map(r => r.participant_id))
  const out: PublicActivity = {
    id: activity.id,
    segmentId: activity.segment_id,
    kind: activity.kind,
    prompt: activity.prompt,
    options,
    config: objectOf(activity.config),
    status: activity.status,
    openedAt: activity.opened_at,
    closedAt: activity.closed_at,
    answered: people.size,
    total: 0,
    counts: null,
    words: null,
    tally: null,
  }
  switch (activity.kind) {
    case 'poll': {
      const counts = options.map(() => 0)
      // One vote per participant (slot 0 is unique per participant in the DB).
      const seen = new Set<string>()
      for (const r of rows) {
        if (r.slot !== 0 || seen.has(r.participant_id)) continue
        const o = Number(objectOf(r.value).option)
        if (Number.isInteger(o) && o >= 0 && o < counts.length) { counts[o]++; seen.add(r.participant_id) }
      }
      out.counts = counts
      out.total = seen.size
      break
    }
    case 'cloud': {
      // A word counts once per person, however often they typed it.
      const byWord = new Map<string, Set<string>>()
      for (const r of rows) {
        const w = cleanWord(objectOf(r.value).word)
        if (!w) continue
        const set = byWord.get(w) ?? new Set<string>()
        set.add(r.participant_id)
        byWord.set(w, set)
      }
      const words = [...byWord].map(([word, s]) => ({ word, n: s.size }))
      out.total = words.reduce((n, w) => n + w.n, 0)
      out.words = words.sort((a, b) => b.n - a.n || a.word.localeCompare(b.word)).slice(0, CLOUD_SHOWN)
      break
    }
    case 'boss': {
      // Each person's latest run (slot 0, replaced on every run), once per person.
      const seen = new Set<string>()
      let passed = 0
      for (const r of rows) {
        if (r.slot !== 0 || seen.has(r.participant_id)) continue
        seen.add(r.participant_id)
        if (objectOf(r.value).passed === true) passed++
      }
      const trying = seen.size
      out.tally = { passed, trying, pct: trying ? Math.floor((passed / trying) * 100) : 0 }
      out.total = trying
      break
    }
  }
  return out
}

/** Whether the presenter screen may show a poll's counts yet. */
export function pollRevealed(activity: Pick<PublicActivity, 'kind' | 'status' | 'openedAt'>, now: number): boolean {
  if (activity.kind !== 'poll' || activity.status === 'closed') return true
  if (activity.status !== 'open' || !activity.openedAt) return false
  return now - new Date(activity.openedAt).getTime() >= POLL_REVEAL_MS
}
