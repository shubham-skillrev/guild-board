import { test } from 'node:test'
import assert from 'node:assert/strict'
import { agendaProgress, clock, MEET_LIVE_MAX_MS, meetingLive, type Segment } from './meeting.ts'

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

const seg = (id: string, minutes: number): Segment => ({ id, kind: 'custom', title: id, detail: '', minutes })

test('agendaProgress is weighted by planned minutes and capped per segment', () => {
  const agenda = [seg('a', 2), seg('b', 5), seg('c', 15), seg('d', 18), seg('e', 8), seg('f', 8), seg('g', 4)] // 60 min
  assert.equal(agendaProgress(agenda, 0, 0), 0)
  assert.equal(agendaProgress(agenda, 1, 0), 2 / 60)
  assert.equal(agendaProgress(agenda, 2, 7.5 * 60), (2 + 5 + 7.5) / 60)
  // Overtime doesn't run ahead into the next segment.
  assert.equal(agendaProgress(agenda, 1, 60 * 60), 7 / 60)
  assert.equal(agendaProgress(agenda, 6, 4 * 60), 1)
  assert.equal(agendaProgress(agenda, -1, 0), 0)
  assert.equal(agendaProgress([], 0, 0), 0)
})

test('clock is m:ss of the absolute value', () => {
  assert.equal(clock(0), '0:00')
  assert.equal(clock(65), '1:05')
  assert.equal(clock(-125), '2:05')
  assert.equal(clock(480), '8:00')
})
