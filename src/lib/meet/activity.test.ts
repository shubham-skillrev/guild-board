import { test } from 'node:test'
import assert from 'node:assert/strict'
import { aggregate, cleanResponse, cleanWord, pollRevealed, stageFor, type ActivityRow } from './activity.ts'

const poll: ActivityRow = { id: 'a', cycle_id: 'c', segment_id: 'radar', kind: 'poll', prompt: 'Q?', options: ['Yes', 'No', 'Maybe'], config: {}, status: 'open', opened_at: '2026-11-12T10:00:00Z', closed_at: null }
const cloud: ActivityRow = { ...poll, id: 'b', kind: 'cloud', options: [] }

test('cleanWord lower-cases, trims and caps at 20', () => {
  assert.equal(cleanWord('  Tired!! '), 'tired')
  assert.equal(cleanWord('C++'), 'c++')
  assert.equal(cleanWord('Node.JS.'), 'node.js')
  assert.equal(cleanWord('burnt   out'), 'burnt out')
  assert.equal(cleanWord('a'.repeat(30))?.length, 20)
  assert.equal(cleanWord('🚀🚀'), null)
  assert.equal(cleanWord(''), null)
  assert.equal(cleanWord(42), null)
  assert.equal(cleanWord('थकान'), 'थकान')
})

test('cleanResponse checks the answer against its activity', () => {
  assert.deepEqual(cleanResponse(poll, { option: 2 }), { ok: true, value: { option: 2 } })
  assert.equal(cleanResponse(poll, { option: 3 }).ok, false)
  assert.equal(cleanResponse(poll, { option: '1' }).ok, true)
  assert.equal(cleanResponse(poll, { option: 1.5 }).ok, false)
  // Number(null), Number('') and Number(false) are 0: none of them is a vote for the first option.
  for (const option of [null, '', false, true, [1], ' 1', '-1', undefined]) assert.equal(cleanResponse(poll, { option }).ok, false, JSON.stringify(option))
  assert.deepEqual(cleanResponse(cloud, { word: ' Busy ' }), { ok: true, value: { word: 'busy' } })
  assert.equal(cleanResponse(cloud, { word: '   ' }).ok, false)
  assert.equal(cleanResponse({ kind: 'boss', options: [], config: { problem: 1 } }, { passed: true }).ok, false)
  const boss = { kind: 'boss' as const, options: [], config: { problem: 1 } }
  assert.deepEqual(cleanResponse(boss, { passed: true, tests: 6, of: 6 }), { ok: true, value: { passed: true, tests: 6, of: 6 } })
  assert.equal(cleanResponse(boss, { passed: false, tests: null, of: 6 }).ok, false)
  assert.equal(cleanResponse(boss, { passed: true, tests: 5, of: 6 }).ok, false)
  assert.equal(cleanResponse(boss, { passed: true, tests: 4, of: 4 }).ok, false)
})

test('poll aggregate counts one vote per participant', () => {
  const a = aggregate(poll, [
    { participant_id: 'p1', slot: 0, value: { option: 0 } },
    { participant_id: 'p2', slot: 0, value: { option: 0 } },
    { participant_id: 'p3', slot: 0, value: { option: 2 } },
    { participant_id: 'p3', slot: 0, value: { option: 1 } }, // a duplicate row must not count twice
    { participant_id: 'p4', slot: 0, value: { option: 9 } }, // out of range
  ])
  assert.deepEqual(a.counts, [2, 0, 1])
  assert.equal(a.total, 3)
  assert.deepEqual(a.words, null)
})

test('cloud aggregate merges words across people, once per person', () => {
  const a = aggregate(cloud, [
    { participant_id: 'p1', slot: 0, value: { word: 'tired' } },
    { participant_id: 'p1', slot: 1, value: { word: 'Tired' } },
    { participant_id: 'p2', slot: 0, value: { word: 'TIRED ' } },
    { participant_id: 'p2', slot: 1, value: { word: 'busy' } },
    { participant_id: 'p3', slot: 0, value: { word: 'chaos' } },
  ])
  assert.deepEqual(a.words, [{ word: 'tired', n: 2 }, { word: 'busy', n: 1 }, { word: 'chaos', n: 1 }])
  assert.equal(a.answered, 3)
  assert.equal(a.total, 4)
})

test('poll counts stay hidden for the first 8 s', () => {
  const opened = new Date(poll.opened_at!).getTime()
  const p = { kind: 'poll' as const, status: 'open' as const, openedAt: poll.opened_at }
  assert.equal(pollRevealed(p, opened + 7_999), false)
  assert.equal(pollRevealed(p, opened + 8_000), true)
  assert.equal(pollRevealed({ ...p, status: 'closed' }, opened), true)
  assert.equal(pollRevealed({ ...p, kind: 'cloud' }, opened), true)
})

test('a cleaned word is still checked as typed', async () => {
  const { isBlocked } = await import('./profanity.ts')
  // cleanWord drops $ ! *, so the server checks the typed text as well.
  for (const typed of ['sh!t', 'a$$', 'f*ck', 'b!tch']) {
    assert.equal(isBlocked(typed) || isBlocked(cleanWord(typed) ?? ''), true, typed)
  }
})

test('stageFor: cards unless open; closed brings the cards back with the results small', () => {
  assert.deepEqual(stageFor(null), { hero: 'cards', strip: null })
  assert.deepEqual(stageFor({ status: 'ready' }), { hero: 'cards', strip: 'ready' })
  assert.deepEqual(stageFor({ status: 'open' }), { hero: 'activity', strip: null })
  assert.deepEqual(stageFor({ status: 'open' }, true), { hero: 'activity', strip: null })
  assert.deepEqual(stageFor({ status: 'closed' }), { hero: 'cards', strip: 'results' })
  assert.deepEqual(stageFor({ status: 'closed' }, true), { hero: 'activity', strip: null })
})
