import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { cleanAgenda, cleanCards, earlyStartWarning, MEET_LEAD_MS, MEET_LIVE_MAX_MS, meetingLive, phoneAgenda, publicSegments, segmentCards } from './meeting.ts'

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

const stored = JSON.parse(readFileSync(new URL('../../docs/agendas/2026-11.json', import.meta.url), 'utf8')).agenda as { prep: { points: string[]; opener: string; ask: string[] } }[]
const secrets = stored.flatMap(s => [...s.prep.points, s.prep.opener])

test('phones: the cards go to everyone, the presenter notes only to who presents', () => {
  // As GET /api/meet builds it for a member, a guest (no id) and another admin.
  for (const viewer of ['member-1', null, 'other-admin']) {
    const view = JSON.stringify(phoneAgenda(stored, viewer, 'presenter-1'))
    for (const s of secrets) if (s !== 'You lot tell me what to write all day. Let’s see if you can still code.') assert.ok(!view.includes(s), `leaked to ${viewer}: ${s}`)
    assert.equal(phoneAgenda(stored, viewer, 'presenter-1').notes, null)
  }
  // No presenter yet: nobody gets notes, not even a viewer whose id is empty.
  assert.equal(phoneAgenda(stored, null, null).notes, null)
  assert.equal(phoneAgenda(stored, '', '').notes, null)
  const mine = phoneAgenda(stored, 'presenter-1', 'presenter-1')
  assert.deepEqual(mine.notes?.radar.points, stored[1].prep.points)
  // Even for the presenter, the public agenda itself carries no prep.
  assert.ok(mine.agenda.every(s => !('prep' in s)))
  assert.ok(!JSON.stringify(mine.agenda).includes('"ask"'))
})

test('cards: unknown kinds, bad links and over-long text are cut', () => {
  const cards = cleanCards([
    { kind: 'news', title: 'T', source: 'S', url: 'javascript:alert(1)', why: 'w' },
    { kind: 'news', title: 'T2', source: 'S', url: 'https://example.com/a', why: 'x'.repeat(500) },
    { kind: 'post', postId: 'not-a-uuid' },
    { kind: 'slot', label: 'Spotlight', status: 'maybe' },
    { kind: 'side', label: 'A' },
    { kind: 'poll' },
  ])
  assert.deepEqual(cards[0], { kind: 'news', title: 'T', source: 'S', why: 'w' })
  assert.equal(cards[1].kind === 'news' && cards[1].url, 'https://example.com/a')
  assert.equal(cards[1].kind === 'news' && cards[1].why.length, 180)
  assert.deepEqual(cards[2], { kind: 'slot', label: 'Spotlight', status: 'open' })
  assert.equal(cards.length, 3)
})

test('an agenda from before cards: its posts become post cards, its detail stays', () => {
  const old = cleanAgenda([{ id: 'topic', kind: 'topic', title: 'T', detail: 'D', minutes: 5, topicIds: ['61f7a2f7-621b-4b74-b406-39f95844a935'] }])
  assert.equal(old[0].cue, undefined)
  assert.equal(old[0].cards, undefined)
  assert.deepEqual(segmentCards(old[0]), [{ kind: 'post', postId: '61f7a2f7-621b-4b74-b406-39f95844a935' }])
  assert.equal(publicSegments(old)[0].detail, 'D')
})
