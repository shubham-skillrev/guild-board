import { test } from 'node:test'
import assert from 'node:assert/strict'
import { remoteNav } from './clicker.ts'
import { navBlocked } from './slides.ts'
import type { Segment } from '../meeting.ts'

const agenda = [
  { id: 'hello', slide: 'title' },
  { id: 'poll', slide: 'activity' },
  { id: 'poll-results', slide: 'results', of: 'poll' },
  { id: 'cloud', slide: 'activity' },
  { id: 'end', slide: 'text' },
] as Pick<Segment, 'id' | 'slide' | 'of'>[]

test('an ordinary slide: Back and Next, no activity button', () => {
  assert.deepEqual(remoteNav(agenda, 0, null), { prev: null, next: 1, locked: false, action: null, closeTo: null })
  assert.deepEqual(remoteNav(agenda, 4, null), { prev: 3, next: null, locked: false, action: null, closeTo: null })
})

test('an activity slide: open it, then it holds the slide until closed (as navBlocked says)', () => {
  const ready = remoteNav(agenda, 1, { segmentId: 'poll', status: 'ready' })
  assert.equal(ready.action, 'open')
  assert.equal(ready.next, 2)
  const open = remoteNav(agenda, 1, { segmentId: 'poll', status: 'open' })
  assert.deepEqual(open, { prev: null, next: null, locked: true, action: 'close', closeTo: 2 })
  // The server agrees: Back is refused, the move to its results goes (that's what close does).
  const acts = [{ id: 'x', segment_id: 'poll', status: 'open' as const }]
  assert.equal(navBlocked(agenda, 'poll', 'hello', acts), true)
  assert.equal(navBlocked(agenda, 'poll', 'poll-results', acts), false)
  const closed = remoteNav(agenda, 1, { segmentId: 'poll', status: 'closed' })
  assert.equal(closed.action, 'reopen')
  assert.equal(closed.locked, false)
})

test('no results slide after it: close in place', () => {
  assert.equal(remoteNav(agenda, 3, { segmentId: 'cloud', status: 'open' }).closeTo, null)
})

test('a results slide shows its activity but has no button of its own', () => {
  assert.deepEqual(remoteNav(agenda, 2, { segmentId: 'poll', status: 'closed' }), { prev: 1, next: 3, locked: false, action: null, closeTo: null })
})

test('out of range: everything off', () => {
  assert.deepEqual(remoteNav(agenda, 9, null), { prev: null, next: null, locked: false, action: null, closeTo: null })
})
