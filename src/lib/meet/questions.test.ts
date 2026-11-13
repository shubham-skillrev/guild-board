import { test } from 'node:test'
import assert from 'node:assert/strict'
import { ASK_GAP_MS, ASK_MAX, askRefusal, buildQueue, checkQuestion, cleanQuestion, openCount, QUESTION_MAX, QUEUE_SHOWN, sortQueue, voteChange } from './questions.ts'

test('cleanQuestion: one line, trimmed, capped, not too short', () => {
  assert.equal(cleanQuestion('  How   do\nwe vote?  '), 'How do we vote?')
  assert.equal(cleanQuestion('ok'), null)
  assert.equal(cleanQuestion(42), null)
  assert.equal([...(cleanQuestion('a'.repeat(500)) ?? '')].length, QUESTION_MAX)
  assert.equal(cleanQuestion('why\u0000​not'), 'why not')
})

test('checkQuestion: Kers filters it (a quiet drop), as typed too', () => {
  assert.deepEqual(checkQuestion('What is the plan for Q1?'), { ok: true, text: 'What is the plan for Q1?' })
  const bad = checkQuestion('why is this so sh1t')
  assert.equal(bad.ok, false)
  assert.equal(!bad.ok && bad.blocked, true)
  assert.equal(checkQuestion('  ').ok, false)
  // The Scunthorpe guard holds for questions too.
  assert.equal(checkQuestion('Which class should I assess first?').ok, true)
})

test('askRefusal: a cap per meeting and a gap between questions', () => {
  const now = 10_000_000
  assert.equal(askRefusal([], now), null)
  assert.match(askRefusal([now - ASK_GAP_MS + 1], now) ?? '', /every/)
  assert.equal(askRefusal([now - ASK_GAP_MS], now), null)
  assert.match(askRefusal(Array.from({ length: ASK_MAX }, (_, i) => now - (i + 1) * 3_600_000), now) ?? '', /your/)
})

test('voteChange: one vote per person, answered questions take no new ones', () => {
  assert.equal(voteChange(false, true, false), 'add')
  assert.equal(voteChange(true, true, false), 'none')
  assert.equal(voteChange(true, false, false), 'remove')
  assert.equal(voteChange(false, false, false), 'none')
  assert.equal(voteChange(false, true, true), 'none')
  assert.equal(voteChange(true, false, true), 'remove')
})

test('the queue: open first, most votes, then oldest; capped', () => {
  const q = (id: string, votes: number, answered = false, at = '2026-11-13T10:00:00Z') => ({ id, text: id, votes, answered, at })
  const sorted = sortQueue([q('a', 1), q('b', 5, true), q('c', 3), q('d', 3, false, '2026-11-13T09:00:00Z')])
  assert.deepEqual(sorted.map(x => x.id), ['d', 'c', 'a', 'b'])
  assert.equal(openCount(sorted), 3)
  const rows = Array.from({ length: QUEUE_SHOWN + 5 }, (_, i) => ({ id: `q${i}`, body: `Question ${i}`, created_at: `2026-11-13T10:${String(i).padStart(2, '0')}:00Z`, answered_at: i === 0 ? '2026-11-13T11:00:00Z' : null, votes: i % 7 }))
  const queue = buildQueue(rows)
  assert.equal(queue.length, QUEUE_SHOWN)
  assert.equal(queue[0].votes, 6)
  assert.ok(!queue.some(x => x.id === 'q0'), 'an answered one sinks below the cut')
  // Never who asked: text, votes, answered, when.
  assert.deepEqual(Object.keys(queue[0]).sort(), ['answered', 'at', 'id', 'text', 'votes'])
})
