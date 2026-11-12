import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Worker as ThreadWorker } from 'node:worker_threads'
import { BOSS_PROBLEMS, BOSS_TEST_MS, summarise, WORKER_SOURCE } from './boss.ts'
import { runBoss } from './bossRunner.ts'

/**
 * A browser Worker for Node: the worker's own source on a real thread, so an
 * infinite loop really hangs it and terminate() really kills it. Messages
 * are structured-cloned both ways, like the browser's.
 */
let started = 0
let killed = 0
class FakeWorker {
  onmessage: ((e: { data: unknown }) => void) | null = null
  onerror: ((e: { message: string; preventDefault(): void }) => void) | null = null
  onmessageerror: (() => void) | null = null
  #t: ThreadWorker
  constructor() {
    started++
    const src = `const { parentPort } = require('node:worker_threads');
      const self = { postMessage: m => parentPort.postMessage(m) };
      ${WORKER_SOURCE}
      parentPort.on('message', d => self.onmessage({ data: d }));`
    this.#t = new ThreadWorker(src, { eval: true })
    this.#t.on('message', data => this.onmessage?.({ data }))
    this.#t.on('error', err => this.onerror?.({ message: String(err), preventDefault() {} }))
  }
  postMessage(m: unknown) { this.#t.postMessage(m) }
  terminate() { killed++; void this.#t.terminate() }
}
;(globalThis as { Worker?: unknown }).Worker = FakeWorker

const sumEvens = BOSS_PROBLEMS[0]
const reset = () => { started = 0; killed = 0 }

test('runner: a correct solution passes every test, one worker for the run', async () => {
  reset()
  const r = await runBoss('function sumEvens(nums) { return nums.filter(n => n % 2 === 0).reduce((a, b) => a + b, 0) }', sumEvens)
  assert.equal(r.fatal, null)
  assert.deepEqual(summarise(r.results, sumEvens.cases.length), { passed: true, tests: 6, of: 6 })
  assert.equal(started, 1)
  assert.equal(killed, 1, 'the worker is terminated when the run ends')
})

test('runner: an infinite loop times out, its worker is killed, and a fresh one runs the rest', async () => {
  reset()
  // Loops forever on the empty array (test 2 of 6) only.
  const code = 'function sumEvens(nums) { while (nums.length === 0) {} return nums.filter(n => n % 2 === 0).reduce((a, b) => a + b, 0) }'
  const seen: number[] = []
  const t0 = Date.now()
  const r = await runBoss(code, sumEvens, i => seen.push(i))
  const took = Date.now() - t0
  assert.equal(r.fatal, null)
  assert.equal(r.results[1].ok, false)
  assert.equal(r.results[1].timedOut, true)
  assert.deepEqual(r.results.map(x => x.ok), [true, false, true, true, true, true])
  assert.deepEqual(seen, [0, 1, 2, 3, 4, 5], 'every test reports, in order')
  assert.equal(started, 2, 'a fresh worker after the timeout')
  assert.equal(killed, 2, 'the hung worker and the last one')
  assert.ok(took >= BOSS_TEST_MS && took < BOSS_TEST_MS + 3000, `took ${took} ms`)
  // What leaves the device: the counts only.
  assert.deepEqual(summarise(r.results, sumEvens.cases.length), { passed: false, tests: 5, of: 6 })
})

test('runner: a syntax error or a missing function fails the run at once', async () => {
  reset()
  const syntax = await runBoss('function sumEvens(nums) { return nums.filter(', sumEvens)
  assert.match(syntax.fatal ?? '', /SyntaxError/)
  assert.equal(syntax.results.length, 6)
  assert.ok(syntax.results.every(x => !x.ok))
  const missing = await runBoss('function sumOdds(nums) { return 0 }', sumEvens)
  assert.equal(missing.fatal, 'No function by that name.')
  assert.equal(started, 2)
  assert.equal(killed, 2)
})

test('runner: a thrown error or an unclonable result fails that test only', async () => {
  const threw = await runBoss('function sumEvens(nums) { if (!nums.length) throw new Error("empty"); return nums.filter(n => n % 2 === 0).reduce((a, b) => a + b, 0) }', sumEvens)
  assert.deepEqual(threw.results.map(x => x.ok), [true, false, true, true, true, true])
  assert.match(threw.results[1].error ?? '', /Error: empty/)
  const fnBack = await runBoss('function sumEvens() { return () => 6 }', sumEvens)
  assert.equal(fnBack.fatal, null)
  assert.ok(fnBack.results.every(x => !x.ok))
  const promise = await runBoss('async function sumEvens(nums) { return 6 }', sumEvens)
  assert.ok(promise.results.every(x => !x.ok), 'an async function returns a Promise, not the number')
})
