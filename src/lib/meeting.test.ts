import { test } from 'node:test'
import assert from 'node:assert/strict'
import { earlyStartWarning, MEET_LEAD_MS, MEET_LIVE_MAX_MS, meetingLive } from './meeting.ts'

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

test('earlyStartWarning: asks only when the meeting is more than 3 h away', () => {
  const at = '2026-11-13T05:30:00.000Z' // Fri 13 Nov, 11:00 IST
  const t = Date.parse(at)
  assert.equal(earlyStartWarning(at, t), null)
  assert.equal(earlyStartWarning(at, t - MEET_LEAD_MS), null)
  assert.equal(earlyStartWarning(at, t + 3_600_000), null)
  assert.equal(earlyStartWarning(null, t), null)
  // The afternoon before (Thu 12 Nov, 15:00 IST).
  assert.equal(earlyStartWarning(at, Date.parse('2026-11-12T09:30:00Z')), 'The meeting is tomorrow at 11:00. Start it now? Everyone will see the live banner.')
  // Same morning, 6 a.m. IST.
  assert.equal(earlyStartWarning(at, Date.parse('2026-11-13T00:30:00Z')), 'The meeting is today at 11:00. Start it now? Everyone will see the live banner.')
})
