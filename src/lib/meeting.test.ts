import { test } from 'node:test'
import assert from 'node:assert/strict'
import { MEET_LIVE_MAX_MS, meetingLive } from './meeting.ts'

test('meetingLive: started, not ended, not left running from long ago', () => {
  const now = Date.parse('2026-11-12T12:00:00Z')
  const at = (ms: number) => new Date(now - ms).toISOString()
  assert.equal(meetingLive({ startedAt: at(60_000), endedAt: null }, now), true)
  assert.equal(meetingLive({ startedAt: null, endedAt: null }, now), false)
  assert.equal(meetingLive({ startedAt: at(60_000), endedAt: at(1000) }, now), false)
  // A test start the day before that nobody ended: the room is shut, so the presenter must see it as off too.
  assert.equal(meetingLive({ startedAt: at(MEET_LIVE_MAX_MS), endedAt: null }, now), false)
  assert.equal(meetingLive({ startedAt: at(MEET_LIVE_MAX_MS - 1), endedAt: null }, now), true)
  assert.equal(meetingLive(null, now), false)
})
