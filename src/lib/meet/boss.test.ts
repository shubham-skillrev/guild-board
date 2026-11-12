import { test } from 'node:test'
import assert from 'node:assert/strict'
import { BOSS_MS, BOSS_PROBLEMS, bossPhase, bossProblem, bossVerdict, deepEqual, judge, summarise, WORKER_SOURCE, type BossProblem, type WorkerReply } from './boss.ts'
import { aggregate, cleanResponse, type ActivityRow } from './activity.ts'

/**
 * The worker's source, run in-process: a fake `self` whose postMessage
 * structured-clones like the real one (so unclonable results behave the same).
 */
function runInWorker(code: string, fn: string, args: unknown[]): WorkerReply {
  let reply: WorkerReply | null = null
  const self = {
    onmessage: null as null | ((e: { data: unknown }) => void),
    postMessage(m: WorkerReply) { reply = structuredClone(m) },
  }
  new Function('self', WORKER_SOURCE)(self)
  self.onmessage!({ data: structuredClone({ code, fn, args }) })
  assert.ok(reply, 'the worker always answers')
  return reply
}

/** The whole problem, the way the page runs it, minus the worker thread and timeout. */
function runAll(p: BossProblem, code: string) {
  const results = p.cases.map(c => judge(c, runInWorker(code, p.fn, c.args)))
  return summarise(results, p.cases.length)
}

const REFERENCE: Record<string, string> = {
  sumEvens: 'function sumEvens(nums) { return nums.filter(n => n % 2 === 0).reduce((a, b) => a + b, 0) }',
  reverseWords: "function reverseWords(s) { return s.split(' ').map(w => [...w].reverse().join('')).join(' ') }",
  isPalindrome: "const isPalindrome = s => { const t = s.toLowerCase().replace(/ /g, ''); return t === [...t].reverse().join('') }",
}

const WRONG: Record<string, string[]> = {
  sumEvens: [
    'function sumEvens(nums) { return nums.reduce((a, b) => a + b, 0) }', // sums everything
    'function sumEvens(nums) { return nums.filter(n => n % 2 === 1).reduce((a, b) => a + b, 0) }', // odds
    'function sumEvens(nums) { return nums.filter(n => n > 0 && n % 2 === 0).reduce((a, b) => a + b, 0) }', // forgets negatives
  ],
  reverseWords: [
    "function reverseWords(s) { return [...s].reverse().join('') }", // reverses the word order too
    "function reverseWords(s) { return s.split(' ').reverse().join(' ') }",
  ],
  isPalindrome: [
    "function isPalindrome(s) { return s === [...s].reverse().join('') }", // case and spaces count
    "function isPalindrome(s) { const t = s.toLowerCase(); return t === [...t].reverse().join('') }", // spaces count
  ],
}

test('the problem list matches the spec', () => {
  assert.deepEqual(BOSS_PROBLEMS.map(p => [p.id, p.fn, p.cases.length]), [[1, 'sumEvens', 6], [2, 'reverseWords', 4], [3, 'isPalindrome', 5]])
  assert.equal(bossProblem({ problem: 1 })?.fn, 'sumEvens')
  assert.equal(bossProblem({ problem: '3' })?.fn, 'isPalindrome')
  assert.equal(bossProblem({ problem: 9 }), null)
  assert.equal(bossProblem(null), null)
})

test('reference solutions pass every test', () => {
  for (const p of BOSS_PROBLEMS) assert.deepEqual(runAll(p, REFERENCE[p.fn]), { passed: true, tests: p.cases.length, of: p.cases.length }, p.fn)
})

test('wrong solutions fail', () => {
  for (const p of BOSS_PROBLEMS) {
    for (const code of WRONG[p.fn]) assert.equal(runAll(p, code).passed, false, code)
  }
})

test('the starter code runs and fails, rather than crashing', () => {
  for (const p of BOSS_PROBLEMS) {
    const r = runInWorker(p.starter, p.fn, p.cases[0].args)
    assert.deepEqual(r, { kind: 'value', value: undefined }, p.fn)
    assert.equal(runAll(p, p.starter).passed, false)
  }
})

test('the worker reports syntax errors, missing functions, throws and unclonable values', () => {
  const syntax = runInWorker('function sumEvens(nums) { return nums.', 'sumEvens', [[1]])
  assert.equal(syntax.kind, 'syntax')
  assert.match((syntax as { error: string }).error, /^SyntaxError/)
  assert.deepEqual(runInWorker('function other() {}', 'sumEvens', [[1]]), { kind: 'missing' })
  const threw = runInWorker('function sumEvens(nums) { return nums.nope() }', 'sumEvens', [[1]])
  assert.equal(threw.kind, 'threw')
  assert.match((threw as { error: string }).error, /^TypeError/)
  assert.equal(runInWorker('function sumEvens() { return () => 1 }', 'sumEvens', [[1]]).kind, 'unclonable')
  assert.equal(judge({ args: [], expected: 1 }, { kind: 'missing' }).ok, false)
})

test('deepEqual compares structure, not identity', () => {
  assert.equal(deepEqual([1, [2, { a: 3 }]], [1, [2, { a: 3 }]]), true)
  assert.equal(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 }), true)
  assert.equal(deepEqual([1, 2], [1, 2, 3]), false)
  assert.equal(deepEqual({ a: undefined }, {}), false)
  assert.equal(deepEqual([], {}), false)
  assert.equal(deepEqual('6', 6), false)
  assert.equal(deepEqual(null, 0), false)
  assert.equal(deepEqual(NaN, NaN), true)
  assert.equal(deepEqual(-0, 0), true)
})

const boss: ActivityRow = { id: 'x', cycle_id: 'c', segment_id: 'boss', kind: 'boss', prompt: 'Sum of the even numbers', options: [], config: { problem: 1 }, status: 'open', opened_at: '2026-11-12T10:00:00Z', closed_at: null }

test('cleanResponse takes a run result, checked against the problem', () => {
  assert.deepEqual(cleanResponse(boss, { passed: true, tests: 6, of: 6 }), { ok: true, value: { passed: true, tests: 6, of: 6 } })
  assert.deepEqual(cleanResponse(boss, { passed: false, tests: 4, of: 6, code: 'secret' }), { ok: true, value: { passed: false, tests: 4, of: 6 } })
  assert.equal(cleanResponse(boss, { passed: true, tests: 4, of: 6 }).ok, false) // passed must mean all
  assert.equal(cleanResponse(boss, { passed: false, tests: 6, of: 6 }).ok, false)
  assert.equal(cleanResponse(boss, { passed: true, tests: 5, of: 5 }).ok, false) // problem 1 has 6 tests
  assert.equal(cleanResponse(boss, { passed: false, tests: 7, of: 6 }).ok, false)
  assert.equal(cleanResponse(boss, { passed: false, tests: -1, of: 6 }).ok, false)
  assert.equal(cleanResponse(boss, { passed: false, tests: 1.5, of: 6 }).ok, false)
  assert.equal(cleanResponse(boss, { passed: 'yes', tests: 6, of: 6 }).ok, false)
  assert.equal(cleanResponse({ ...boss, config: {} }, { passed: true, tests: 6, of: 6 }).ok, false)
})

test('boss aggregate: pass rate of those trying, one run per person', () => {
  const a = aggregate(boss, [
    { participant_id: 'p1', slot: 0, value: { passed: true, tests: 6, of: 6 } },
    { participant_id: 'p2', slot: 0, value: { passed: false, tests: 3, of: 6 } },
    { participant_id: 'p3', slot: 0, value: { passed: true, tests: 6, of: 6 } },
    { participant_id: 'p3', slot: 0, value: { passed: true, tests: 6, of: 6 } }, // a duplicate must not count twice
  ])
  assert.deepEqual(a.tally, { passed: 2, trying: 3, pct: 66 })
  assert.equal(a.total, 3)
  assert.deepEqual(aggregate(boss, []).tally, { passed: 0, trying: 0, pct: 0 })
  // 99.5% is not everyone.
  const many = Array.from({ length: 200 }, (_, i) => ({ participant_id: `p${i}`, slot: 0, value: { passed: i > 0 } }))
  assert.equal(aggregate(boss, many).tally?.pct, 99)
})

test('Kers: intro, then running, then a verdict by pass rate', () => {
  const opened = new Date(boss.opened_at!).getTime()
  const a = { kind: 'boss' as const, status: 'open' as const, openedAt: boss.opened_at, tally: { passed: 5, trying: 8, pct: 62 } }
  assert.deepEqual(bossPhase(a, opened + 1000), { phase: 'intro' })
  assert.deepEqual(bossPhase(a, opened + BOSS_MS - 60_000), { phase: 'running', left: 60 })
  assert.deepEqual(bossPhase(a, opened + BOSS_MS), { phase: 'verdict', pct: 62, trying: 8 })
  assert.deepEqual(bossPhase({ ...a, status: 'closed' }, opened + 1000), { phase: 'verdict', pct: 62, trying: 8 })
  assert.equal(bossPhase({ ...a, status: 'ready' }, opened), null)
  assert.equal(bossVerdict(62, 8), '62% of you can still code. I’m mildly impressed.')
  for (const [pct, trying] of [[0, 0], [0, 4], [10, 10], [40, 10], [80, 10], [100, 1], [100, 9]]) assert.ok(bossVerdict(pct, trying).length > 0)
})
