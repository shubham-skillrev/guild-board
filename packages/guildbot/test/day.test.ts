import { test } from 'node:test'
import assert from 'node:assert/strict'
import { moodOfDay } from '../src/mood.ts'
import { variantOf, daySeed } from '../src/schedule.ts'

test('a post today makes him proud, whatever the board', () => {
  for (const m of ['smug', 'bored', 'dramatic', 'proud'] as const) assert.equal(moodOfDay(m, true, 99), 'proud')
})

test('a bored month still has other days', () => {
  const days = Array.from({ length: 30 }, (_, i) => moodOfDay('bored', false, daySeed(new Date(2026, 9, i + 1), 'mood')))
  assert.ok(days.includes('bored'))
  assert.ok(new Set(days).size >= 2, `only ${[...new Set(days)]}`)
})

test('weather bends his walk and his coffee', () => {
  const d = new Date(2026, 9, 16, 17, 40)
  assert.equal(variantOf('walking', d, { temperature: 35, code: 1 }), 'garden')
  assert.equal(variantOf('walking', d, { temperature: 24, code: 63 }), 'rainwatch')
  assert.equal(variantOf('walking', d, { temperature: 24, code: 1 }), null)
  assert.equal(variantOf('walking', d, null), null)
  assert.equal(variantOf('coffee', d, { temperature: 31, code: 0 }), 'iced')
})

test('the same day plans the same way all day', () => {
  const a = new Date(2026, 9, 16, 13, 5)
  const b = new Date(2026, 9, 16, 13, 50)
  assert.equal(variantOf('lunch', a), variantOf('lunch', b))
})
