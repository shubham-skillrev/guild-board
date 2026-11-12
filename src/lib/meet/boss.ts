/**
 * Kers' Boss Round (docs/06-meeting-mode.md, Phase 3): the fixed problem
 * list, the Web Worker's source, how one test's reply is judged, and what
 * Kers says about the room.
 *
 * Attendees' code runs only in their own browser (lib/meet/bossRunner.ts
 * starts the worker); only { passed, tests, of } is ever sent. The test
 * inputs and expected values ship to the client, so a pass can be faked.
 * That's accepted: no names, no prizes.
 *
 * No runtime imports: the unit tests run it straight under `node --test`.
 */

import type { PublicActivity } from './activity.ts'

/** How long the round runs from the moment it opens. */
export const BOSS_MS = 8 * 60_000
/** Each test gets this long before its worker is killed. */
export const BOSS_TEST_MS = 2000
/** Answers are still taken this long after time, for a run that was mid-flight. */
export const BOSS_GRACE_MS = 30_000
/** Kers' intro line shows this long after the round opens. */
export const BOSS_INTRO_MS = 20_000
export const BOSS_LINE = 'You lot tell me what to write all day. Let’s see if you can still code.'

export interface BossCase {
  args: unknown[]
  expected: unknown
}

export interface BossProblem {
  id: number
  title: string
  description: string
  /** The function the attendee writes. */
  fn: string
  signature: string
  starter: string
  cases: BossCase[]
}

const starter = (sig: string) => `function ${sig} {\n  \n}\n`

export const BOSS_PROBLEMS: BossProblem[] = [
  {
    id: 1,
    title: 'Sum of the even numbers',
    description: 'Return the sum of the even numbers in the array. No even numbers (or no numbers at all) means 0.',
    fn: 'sumEvens',
    signature: 'sumEvens(nums)',
    starter: starter('sumEvens(nums)'),
    cases: [
      { args: [[1, 2, 3, 4]], expected: 6 },
      { args: [[]], expected: 0 },
      { args: [[1, 3]], expected: 0 },
      { args: [[-2, 5, 8]], expected: 6 },
      { args: [[0]], expected: 0 },
      { args: [[10]], expected: 10 },
    ],
  },
  {
    id: 2,
    title: 'Reverse each word, keep the word order',
    description: 'Words are separated by single spaces. Reverse the letters of each word, but keep the words in their places.',
    fn: 'reverseWords',
    signature: 'reverseWords(s)',
    starter: starter('reverseWords(s)'),
    cases: [
      { args: ['hello world'], expected: 'olleh dlrow' },
      { args: [''], expected: '' },
      { args: ['a'], expected: 'a' },
      { args: ['ab cd ef'], expected: 'ba dc fe' },
    ],
  },
  {
    id: 3,
    title: 'Is it a palindrome?',
    description: 'Return true if the string reads the same backwards, ignoring case and spaces. The empty string counts.',
    fn: 'isPalindrome',
    signature: 'isPalindrome(s)',
    starter: starter('isPalindrome(s)'),
    cases: [
      { args: ['Racecar'], expected: true },
      { args: ['nurses run'], expected: true },
      { args: ['hello'], expected: false },
      { args: [''], expected: true },
      { args: ['ab'], expected: false },
    ],
  },
]

/** The problem an activity's config picks (`{ problem: 1 }`), else null. */
export function bossProblem(config: unknown): BossProblem | null {
  const id = config && typeof config === 'object' ? Number((config as { problem?: unknown }).problem) : NaN
  return BOSS_PROBLEMS.find(p => p.id === id) ?? null
}

/** Structural equality for what a test can return: primitives, arrays, plain objects. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  if (typeof a === 'number' && typeof b === 'number') return Number.isNaN(a) && Number.isNaN(b)
  if (!a || !b || typeof a !== 'object' || typeof b !== 'object') return false
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]))
  const ka = Object.keys(a)
  const kb = Object.keys(b)
  return ka.length === kb.length && ka.every(k => Object.prototype.hasOwnProperty.call(b, k) && deepEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]))
}

/** A value as the phone shows it: `"olleh"`, `6`, `[1,2]`, `undefined`. */
export function showValue(v: unknown): string {
  if (v === undefined) return 'undefined'
  if (typeof v === 'number' && !Number.isFinite(v)) return String(v)
  try {
    const s = JSON.stringify(v)
    return s === undefined ? String(v) : s.length > 80 ? `${s.slice(0, 79)}…` : s
  } catch {
    return String(v)
  }
}

/** What the worker answers for one test. */
export type WorkerReply =
  | { kind: 'value'; value: unknown }
  /** The result couldn't cross to the page (a function, a Promise…). */
  | { kind: 'unclonable'; shown: string }
  | { kind: 'threw'; error: string }
  | { kind: 'syntax'; error: string }
  | { kind: 'missing' }

/** What the worker is asked: run `fn` from `code` on one test's arguments. */
export interface WorkerAsk {
  code: string
  fn: string
  args: unknown[]
}

/**
 * The worker, as source for a Blob URL: no bundler involved, and each run
 * gets a fresh one. It compiles the attendee's code (a syntax error is
 * reported, not thrown), runs it, and calls their function on one test's
 * arguments. The page compares the reply (judge()); the worker only runs.
 * Plain ES5-ish JS: it is never transpiled.
 */
export const WORKER_SOURCE = `
self.onmessage = function (e) {
  var d = e.data;
  var describe = function (err) {
    return err && err.name ? err.name + ': ' + err.message : String(err);
  };
  var make;
  try {
    make = new Function(d.code + '\\n;return typeof ' + d.fn + ' === "function" ? ' + d.fn + ' : undefined;');
  } catch (err) {
    self.postMessage({ kind: 'syntax', error: describe(err) });
    return;
  }
  var fn, value;
  try {
    fn = make();
    if (typeof fn !== 'function') {
      self.postMessage({ kind: 'missing' });
      return;
    }
    value = fn.apply(null, d.args);
  } catch (err) {
    self.postMessage({ kind: 'threw', error: describe(err) });
    return;
  }
  try {
    self.postMessage({ kind: 'value', value: value });
  } catch (err) {
    var shown;
    try { shown = String(value); } catch (e2) { shown = typeof value; }
    self.postMessage({ kind: 'unclonable', shown: shown });
  }
};
`

/** One test's outcome, as the phone lists it. */
export interface CaseResult {
  ok: boolean
  /** What their function returned, when it returned. */
  got?: string
  /** What it threw, or why it didn't run. */
  error?: string
  timedOut?: boolean
}

/** A worker's reply to one test, judged against the expected value. */
export function judge(c: BossCase, reply: WorkerReply): CaseResult {
  switch (reply.kind) {
    case 'value':
      return { ok: deepEqual(reply.value, c.expected), got: showValue(reply.value) }
    case 'unclonable':
      return { ok: false, got: reply.shown }
    case 'threw':
    case 'syntax':
      return { ok: false, error: reply.error }
    case 'missing':
      return { ok: false, error: 'No function by that name.' }
  }
}

export const timedOut = (): CaseResult => ({ ok: false, timedOut: true, error: `Took longer than ${BOSS_TEST_MS / 1000} s. Stopped.` })

/** A run's results as sent to the server: never the code. */
export function summarise(results: CaseResult[], of: number): { passed: boolean; tests: number; of: number } {
  const tests = results.filter(r => r.ok).length
  return { passed: tests === of && results.length === of, tests, of }
}

/** The arguments for one test, shown as a call: `sumEvens([1,2,3,4])`. */
export function callText(p: BossProblem, c: BossCase): string {
  return `${p.fn}(${c.args.map(showValue).join(', ')})`
}

export type BossPhase =
  | { phase: 'intro' }
  | { phase: 'running'; left: number }
  | { phase: 'verdict'; pct: number; trying: number }

/** Where an open or closed Boss Round is, by the server's clock. Null when not on. */
export function bossPhase(a: Pick<PublicActivity, 'kind' | 'status' | 'openedAt' | 'tally'>, now: number): BossPhase | null {
  if (a.kind !== 'boss' || a.status === 'ready' || !a.openedAt) return null
  const elapsed = now - new Date(a.openedAt).getTime()
  if (a.status === 'open' && elapsed < BOSS_INTRO_MS) return { phase: 'intro' }
  if (a.status === 'open' && elapsed < BOSS_MS) return { phase: 'running', left: Math.ceil((BOSS_MS - elapsed) / 1000) }
  return { phase: 'verdict', pct: a.tally?.pct ?? 0, trying: a.tally?.trying ?? 0 }
}

/** Kers' verdict at time, by the share of those trying who passed every test. */
export function bossVerdict(pct: number, trying: number): string {
  if (trying === 0) return 'Nobody even tried. I’ll take that as a compliment.'
  if (pct === 0) return '0%. Fine. I’ll keep writing your code, then.'
  if (pct === 100) return trying === 1 ? 'One of you tried, and passed. Show-off.' : '100%. Either you can all code or you’ve all learnt to cheat. Both are skills.'
  if (pct < 25) return `${pct}% of you can still code. The rest of you: I’m here all week.`
  if (pct < 50) return `${pct}% of you can still code. Not bad. Not good either.`
  if (pct < 75) return `${pct}% of you can still code. I’m mildly impressed.`
  return `${pct}% of you can still code. Fine. I’m impressed. Don’t tell anyone.`
}
