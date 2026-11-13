import { test } from 'node:test'
import assert from 'node:assert/strict'
import { FLOAT_CAP, isReaction, noReactions, REACT_GAP_MS, REACT_MAX, reactionAllowed, reactionBursts, reactionCount, sumReactions } from './reactions.ts'

test('reactionAllowed: one per 1.5 s, a cap per meeting', () => {
  const now = 1_000_000
  assert.equal(reactionAllowed(0, 0, now), true)
  assert.equal(reactionAllowed(3, now - REACT_GAP_MS + 1, now), false)
  assert.equal(reactionAllowed(3, now - REACT_GAP_MS, now), true)
  assert.equal(reactionAllowed(REACT_MAX - 1, now - 60_000, now), true)
  assert.equal(reactionAllowed(REACT_MAX, now - 60_000, now), false)
})

test('only the three reactions', () => {
  for (const r of ['fire', 'laugh', 'clap']) assert.equal(isReaction(r), true)
  for (const r of ['heart', '', null, 1, '🔥', 'FIRE']) assert.equal(isReaction(r), false)
})

test('counts and totals ignore junk', () => {
  assert.equal(reactionCount({ fire: 2, laugh: '3', clap: -1 }), 5)
  assert.equal(reactionCount(null), 0)
  assert.deepEqual(sumReactions([{ fire: 1, clap: 2 }, { fire: 3, laugh: 1 }, {}]), { fire: 4, laugh: 1, clap: 2 })
})

test('reactionBursts floats only what is new, capped, never on first sight or after a wipe', () => {
  assert.deepEqual(reactionBursts(null, { fire: 5, laugh: 0, clap: 0 }), [])
  assert.deepEqual(reactionBursts(noReactions(), { fire: 2, laugh: 0, clap: 1 }), ['fire', 'fire', 'clap'])
  assert.equal(reactionBursts(noReactions(), { fire: 50, laugh: 0, clap: 0 }).length, FLOAT_CAP)
  assert.deepEqual(reactionBursts({ fire: 9, laugh: 2, clap: 1 }, noReactions()), [])
})
