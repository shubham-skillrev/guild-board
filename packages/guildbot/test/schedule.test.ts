import { test } from 'node:test'
import assert from 'node:assert/strict'
import { activityAt, meetingOn, meetingJustEnded } from '../src/schedule.ts'

// 2026-10-16 is a Friday, 2026-10-17 a Saturday (local time).
const at = (day: number, h: number, m = 0) => new Date(2026, 9, day, h, m)

test('a weekday: asleep, up, coding, lunch, walk, book, music, calm, asleep', () => {
  assert.equal(activityAt(at(16, 3)), 'sleeping')
  assert.equal(activityAt(at(16, 7, 10)), 'waking')
  assert.equal(activityAt(at(16, 7, 45)), 'brushing')
  assert.equal(activityAt(at(16, 8, 30)), 'coffee')
  assert.equal(activityAt(at(16, 11)), 'coding')
  assert.equal(activityAt(at(16, 13, 20)), 'lunch')
  assert.equal(activityAt(at(16, 15)), 'coding')
  assert.equal(activityAt(at(16, 17, 40)), 'walking')
  assert.equal(activityAt(at(16, 18, 30)), 'learning')
  assert.equal(activityAt(at(16, 20)), 'music')
  assert.equal(activityAt(at(16, 21, 30)), 'meditating')
  assert.equal(activityAt(at(16, 23)), 'sleeping')
})

test('weekends start late', () => {
  assert.equal(activityAt(at(17, 8)), 'sleeping')
  assert.equal(activityAt(at(17, 11, 30)), 'learning')
  assert.equal(activityAt(at(17, 17, 30)), 'coding')
})

test('the meeting window, and the day after it', () => {
  const start = at(13, 11).toISOString()
  assert.equal(meetingOn(start, at(13, 10, 59)), false)
  assert.equal(meetingOn(start, at(13, 11, 30)), true)
  assert.equal(meetingOn(start, at(13, 12)), false)
  assert.equal(meetingJustEnded(start, at(13, 15)), true)
  assert.equal(meetingJustEnded(start, at(14, 13)), false)
  assert.equal(meetingOn(null, at(13, 11, 30)), false)
})
