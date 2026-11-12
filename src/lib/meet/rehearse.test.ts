import { test } from 'node:test'
import assert from 'node:assert/strict'
import { addAnswer, rehearseActivity, split, withAnswer, REHEARSE_ROOM } from './rehearse.ts'
import type { PublicActivity } from './activity.ts'

const base = (kind: PublicActivity['kind'], options: string[] = []): PublicActivity => ({
  id: 'a', segmentId: 's', kind, prompt: 'Q', options, config: { problem: 1 }, status: 'ready', openedAt: null, closedAt: null,
  answered: 0, total: 0, counts: null, words: null, tally: null,
})

test('split adds up', () => {
  assert.deepEqual(split(10, [1, 1, 1]).reduce((a, b) => a + b, 0), 10)
  assert.deepEqual(split(0, [1, 2]), [0, 0])
})

test('rehearsal: ready until opened, then sample answers that fill over ~25 s', () => {
  const now = Date.parse('2026-11-12T10:00:00Z')
  const poll = base('poll', ['a', 'b', 'c'])
  assert.deepEqual(rehearseActivity(poll, undefined, now).counts, [0, 0, 0])
  const opened = { status: 'open' as const, openedAt: new Date(now).toISOString() }
  assert.equal(rehearseActivity(poll, opened, now).answered, 0)
  const full = rehearseActivity(poll, opened, now + 60_000)
  assert.equal(full.counts!.reduce((a, b) => a + b, 0), full.answered)
  assert.ok(full.answered > 0 && full.answered <= REHEARSE_ROOM)
  const cloud = rehearseActivity(base('cloud'), { status: 'closed', openedAt: opened.openedAt }, now)
  assert.ok(cloud.words!.length > 5)
  const boss = rehearseActivity(base('boss'), opened, now + 60_000)
  assert.ok(boss.tally!.trying > 0 && boss.tally!.passed <= boss.tally!.trying)
})

test('withAnswer: one more vote, word or run on top of the sample', () => {
  const poll = { ...base('poll', ['a', 'b']), status: 'open' as const, counts: [2, 1], answered: 3, total: 3 }
  assert.deepEqual(withAnswer(poll, [{ option: 1 }]).counts, [2, 2])
  assert.equal(withAnswer(poll, null), poll)
  const cloud = { ...base('cloud'), status: 'open' as const, words: [{ word: 'git', n: 2 }] }
  assert.deepEqual(withAnswer(cloud, [{ word: 'git' }, { word: 'vim' }]).words, [{ word: 'git', n: 3 }, { word: 'vim', n: 1 }])
  const boss = { ...base('boss'), status: 'open' as const, tally: { passed: 1, trying: 3, pct: 33 } }
  assert.deepEqual(withAnswer(boss, [{ passed: true, tests: 6, of: 6 }]).tally, { passed: 2, trying: 4, pct: 50 })
  assert.deepEqual(addAnswer('cloud', [{ word: 'a' }], { word: 'b' }), [{ word: 'a' }, { word: 'b' }])
  assert.deepEqual(addAnswer('poll', [{ option: 0 }], { option: 1 }), [{ option: 1 }])
})
