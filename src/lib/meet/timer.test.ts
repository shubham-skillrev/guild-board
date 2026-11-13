import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  ANSWER_GRACE_MS,
  cleanDuration,
  clockSkew,
  closesAtFor,
  DEFAULT_DURATION_S,
  dueToClose,
  durationFor,
  expired,
  extendClosesAt,
  formatClock,
  fractionLeft,
  MAX_DURATION_S,
  MIN_DURATION_S,
  missing048,
  remainingMs,
  ringHeat,
  ringStage,
  settleExpired,
  tooLate,
  totalMs,
} from './timer.ts'
import { rehearseActivity } from './rehearse.ts'
import { cleanAgenda } from '../meeting.ts'
import type { PublicActivity } from './activity.ts'

const T0 = Date.parse('2026-12-10T10:00:00Z')
const iso = (t: number) => new Date(t).toISOString()

test('durations: the slide’s own, else the kind’s default (poll/cloud 2:10, boss 5:00)', () => {
  assert.equal(DEFAULT_DURATION_S.poll, 130)
  assert.equal(DEFAULT_DURATION_S.cloud, 130)
  assert.equal(DEFAULT_DURATION_S.boss, 300)
  assert.equal(durationFor('poll'), 130)
  assert.equal(durationFor('boss', {}), 300)
  assert.equal(durationFor('boss', { duration_s: 60 }), 60)
  assert.equal(durationFor('cloud', { duration_s: 'nope' }), 130)
})

test('cleanDuration: whole seconds, clamped, junk is undefined', () => {
  assert.equal(cleanDuration(90.4), 90)
  assert.equal(cleanDuration('45'), 45)
  assert.equal(cleanDuration(1), MIN_DURATION_S)
  assert.equal(cleanDuration(99_999), MAX_DURATION_S)
  for (const bad of [undefined, null, '', 'x', NaN, Infinity, {}, [30]]) assert.equal(cleanDuration(bad), undefined)
})

test('remaining time and expiry', () => {
  const closes = closesAtFor(T0, 130)
  assert.equal(closes, iso(T0 + 130_000))
  assert.equal(remainingMs(closes, T0), 130_000)
  assert.equal(remainingMs(closes, T0 + 200_000), 0)
  assert.equal(remainingMs(null, T0), null)
  assert.equal(expired(closes, T0 + 129_999), false)
  assert.equal(expired(closes, T0 + 130_000), true)
  assert.equal(expired(null, T0 + 1e9), false, 'untimed never expires')
  assert.equal(tooLate(closes, T0 + 130_000 + ANSWER_GRACE_MS - 1), false, 'a second of grace')
  assert.equal(tooLate(closes, T0 + 130_000 + ANSWER_GRACE_MS), true)
  assert.equal(tooLate(undefined, T0), false)
})

test('+30s: from the close time, or from now once it ran out; capped; untimed is null', () => {
  const closes = iso(T0 + 10_000)
  assert.equal(extendClosesAt(closes, T0), iso(T0 + 40_000))
  assert.equal(extendClosesAt(closes, T0 + 20_000), iso(T0 + 50_000), 'already out: now + 30 s')
  assert.equal(extendClosesAt(iso(T0 + MAX_DURATION_S * 1000), T0), iso(T0 + MAX_DURATION_S * 1000), 'capped')
  assert.equal(extendClosesAt(null, T0), null)
})

test('ring: total grows with +30s, stage and heat over the last 20%', () => {
  assert.equal(totalMs(iso(T0), iso(T0 + 100_000)), 100_000)
  assert.equal(totalMs(null, iso(T0)), null)
  assert.equal(fractionLeft(50, null), 1)
  assert.equal(ringStage(50_000, 100_000), 'calm')
  assert.equal(ringStage(20_001, 100_000), 'calm')
  assert.equal(ringStage(20_000, 100_000), 'warn')
  assert.equal(ringStage(1, 100_000), 'warn')
  assert.equal(ringStage(0, 100_000), 'end')
  assert.equal(ringHeat(50_000, 100_000), 0)
  assert.equal(ringHeat(20_000, 100_000), 0)
  assert.equal(ringHeat(10_000, 100_000), 0.5)
  assert.equal(ringHeat(0, 100_000), 1)
})

test('clock: m:ss rounding up, and the skew from a server time', () => {
  assert.equal(formatClock(130_000), '2:10')
  assert.equal(formatClock(59_001), '1:00')
  assert.equal(formatClock(500), '0:01')
  assert.equal(formatClock(0), '0:00')
  assert.equal(formatClock(-5), '0:00')
  assert.equal(clockSkew(iso(T0 + 1500), T0), 1500)
  assert.equal(clockSkew(null, T0), 0)
})

test('dueToClose: only open ones whose time passed', () => {
  const rows = [
    { id: 'a', status: 'open', closes_at: iso(T0 - 1) },
    { id: 'b', status: 'open', closes_at: iso(T0 + 1) },
    { id: 'c', status: 'closed', closes_at: iso(T0 - 1) },
    { id: 'd', status: 'open', closes_at: null },
    { id: 'e', status: 'open' },
  ]
  assert.deepEqual(dueToClose(rows, T0).map(r => r.id), ['a'])
})

test('missing048 spots the missing column only', () => {
  assert.equal(missing048({ message: 'column "closes_at" of relation "meeting_activities" does not exist' }), true)
  assert.equal(missing048({ message: 'something else' }), false)
  assert.equal(missing048(null), false)
})

test('agenda keeps duration_s on activity slides (and old segments) only', () => {
  const [act, res, old] = cleanAgenda([
    { id: 'p', slide: 'activity', title: 'Poll', duration_s: 75 },
    { id: 'r', slide: 'results', of: 'p', title: 'Results', duration_s: 75 },
    { id: 'o', title: 'Old', minutes: 5, duration_s: 3 },
  ])
  assert.equal(act.duration_s, 75)
  assert.equal(res.duration_s, undefined)
  assert.equal(old.duration_s, MIN_DURATION_S)
  assert.equal(cleanAgenda([{ id: 'q', slide: 'activity', title: 'Q' }])[0].duration_s, undefined)
})

test('rehearsal: an open activity past its closesAt reads as closed', () => {
  const a: PublicActivity = {
    id: 'a', segmentId: 's', kind: 'poll', prompt: 'Q', options: ['x', 'y'], config: {}, status: 'ready', openedAt: null, closedAt: null,
    answered: 0, total: 0, counts: null, words: null, tally: null,
  }
  const local = { status: 'open' as const, openedAt: iso(T0), closesAt: iso(T0 + 130_000) }
  assert.equal(rehearseActivity(a, local, T0 + 60_000).status, 'open')
  assert.equal(rehearseActivity(a, local, T0 + 60_000).closesAt, local.closesAt)
  assert.equal(rehearseActivity(a, local, T0 + 130_000).status, 'closed')
  assert.equal(rehearseActivity(a, { status: 'open', openedAt: iso(T0) }, T0 + 1e9).status, 'open', 'untimed stays open')
})

test('settleExpired: an open activity past its countdown reads as closed, so the slide lock lets go', async () => {
  const { navBlocked } = await import('./slides.ts')
  const now = Date.parse('2026-12-01T10:00:00Z')
  const agenda = [{ id: 'a', slide: 'activity' as const }, { id: 'b', slide: 'content' as const }]
  const rows = [{ id: 'x', segment_id: 'a', status: 'open' as const, closes_at: '2026-12-01T09:59:59Z' }]
  assert.equal(navBlocked(agenda, 'a', 'b', rows), true)
  assert.equal(navBlocked(agenda, 'a', 'b', settleExpired(rows, now)), false)
  // Still running, untimed (before 048) or already closed: unchanged.
  const running = [{ ...rows[0], closes_at: '2026-12-01T10:00:30Z' }]
  assert.equal(navBlocked(agenda, 'a', 'b', settleExpired(running, now)), true)
  assert.deepEqual(settleExpired([{ id: 'y', segment_id: 'a', status: 'open' }], now), [{ id: 'y', segment_id: 'a', status: 'open' }])
  assert.equal(rows[0].status, 'open')
})
