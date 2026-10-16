import { test } from 'node:test'
import assert from 'node:assert/strict'
import { reactTo, type BoardEvent } from '../src/react.ts'
import { LINES } from '../src/lines.ts'

const ctx = { mood: 'smug' as const, recent: 0, hour: 14 }

test('a ghost post looks exactly like a stranger\'s post, on every board', () => {
  for (const mood of ['smug', 'bored', 'dramatic', 'proud'] as const) {
    for (const before of [0, 1, 5]) {
      const ghost = reactTo({ kind: 'post', mine: 'ghost', humanPostsBefore: before }, { ...ctx, mood })
      const stranger = reactTo({ kind: 'post', mine: null, humanPostsBefore: before }, { ...ctx, mood })
      assert.deepEqual(ghost, stranger)
      assert.notEqual(ghost?.line, 'react.posted.you')
    }
  }
})

test('only a named post of your own gets the personal line', () => {
  assert.equal(reactTo({ kind: 'post', mine: 'named', humanPostsBefore: 3 }, ctx)?.line, 'react.posted.you')
})

test('the first human post, or one on a slow board, is a relief', () => {
  assert.equal(reactTo({ kind: 'post', mine: null, humanPostsBefore: 0 }, ctx)?.expression, 'relieved')
  assert.equal(reactTo({ kind: 'post', mine: null, humanPostsBefore: 4 }, { ...ctx, mood: 'bored' })?.expression, 'relieved')
  assert.equal(reactTo({ kind: 'post', mine: null, humanPostsBefore: 4 }, { ...ctx, mood: 'proud' })?.line, 'react.posted.crowd')
})

test('single votes are a face, a burst gets a line', () => {
  assert.equal(reactTo({ kind: 'vote' }, ctx)?.line, null)
  assert.equal(reactTo({ kind: 'vote' }, { ...ctx, recent: 2 })?.line, 'react.excited')
  assert.equal(reactTo({ kind: 'comment' }, ctx)?.expression, 'nosy')
})

test('presence: a crowd arriving, being alone, being alone late', () => {
  const p = (present: number, before: number, hour = 14) => reactTo({ kind: 'presence', present, before }, { ...ctx, hour })
  assert.equal(p(3, 2)?.line, 'react.crowd')
  assert.equal(p(4, 3), null)
  assert.equal(p(1, 2)?.expression, 'lonely')
  assert.equal(p(1, 0, 23)?.expression, 'sleepy')
  assert.equal(p(1, 1), null)
})

test('arriving: relief on a quiet board, a welcome otherwise', () => {
  assert.equal(reactTo({ kind: 'arrive' }, { ...ctx, mood: 'bored' })?.line, 'react.arrive.starved')
  assert.equal(reactTo({ kind: 'arrive' }, ctx)?.line, 'react.arrive')
  assert.equal(reactTo({ kind: 'presence', present: 2, before: 1 }, ctx)?.expression, 'excited')
})

test('every line a reaction can ask for exists', () => {
  const events: BoardEvent[] = [
    { kind: 'post', mine: 'named', humanPostsBefore: 1 }, { kind: 'post', mine: null, humanPostsBefore: 0 },
    { kind: 'post', mine: null, humanPostsBefore: 5 }, { kind: 'vote' }, { kind: 'comment' }, { kind: 'poll' },
    { kind: 'presence', present: 3, before: 1 }, { kind: 'presence', present: 1, before: 2 }, { kind: 'arrive' },
  ]
  for (const e of events) for (const recent of [0, 5]) for (const hour of [12, 23]) {
    const r = reactTo(e, { ...ctx, mood: 'proud', recent, hour })
    if (r?.line) assert.ok(LINES[r.line]?.length, r.line)
  }
})
