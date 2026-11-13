import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isRatingPoll, meetingRecap, meetingReport, reportCards, REPORT_WORDS, type ReportInput } from './report.ts'
import { reportGrid } from './results.ts'
import type { ActivityRow } from './activity.ts'

const CYCLE = '11111111-1111-4111-8111-111111111111'
const USER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const USER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const P = ['p0000000-0000-4000-8000-000000000001', 'p0000000-0000-4000-8000-000000000002', 'p0000000-0000-4000-8000-000000000003']

const act = (id: string, segment: string, kind: ActivityRow['kind'], prompt: string, extra: Partial<ActivityRow> = {}): ActivityRow => ({
  id, cycle_id: CYCLE, segment_id: segment, kind, prompt, options: [], config: {}, status: 'closed', opened_at: '2026-11-13T05:40:00Z', closed_at: '2026-11-13T05:45:00Z', ...extra,
})

const input: ReportInput = {
  label: 'November',
  meetingAt: '2026-11-13T05:30:00Z',
  agenda: [
    { id: 'hello', section: 'Warm-up', title: 'November guild meeting' },
    { id: 'warmup-cloud', slide: 'activity', section: 'Warm-up' },
    { id: 'radar-poll', slide: 'activity', section: 'Radar' },
    { id: 'boss-round', slide: 'activity', section: 'Boss Round' },
    { id: 'clinic-cloud', slide: 'activity', section: 'Problem clinic' },
    { id: 'rate-poll', slide: 'activity', section: 'Wrap' },
    { id: 'thanks', section: 'Wrap', title: 'Thanks, guild.' },
  ],
  participants: [
    { user_id: USER_A, guest_name: null } as { user_id: string | null },
    { user_id: USER_B, guest_name: null } as { user_id: string | null },
    { user_id: null, guest_name: 'Zanzibar Guestname' } as { user_id: string | null },
  ],
  activities: [
    act('a-cloud', 'warmup-cloud', 'cloud', 'The tool you’d refuse to give up'),
    act('a-poll', 'radar-poll', 'poll', 'Production code to a hosted AI model?', { options: ['Yes', 'Enterprise only', 'Self-hosted', 'Never'] }),
    act('a-boss', 'boss-round', 'boss', 'Sum of the even numbers', { config: { problem: 1 } }),
    act('a-empty', 'clinic-cloud', 'cloud', 'What slowed you down?', { status: 'ready', opened_at: null, closed_at: null }),
    act('a-rate', 'rate-poll', 'poll', 'How was today’s meeting?', { options: ['😍 Loved it', '🙂 Good', '😐 Meh', '😕 Not for me'] }),
    act('a-stray', 'not-on-agenda', 'poll', 'Stray', { options: ['a', 'b'] }),
  ],
  responses: [
    { activity_id: 'a-cloud', participant_id: P[0], slot: 0, value: { word: 'vim' } },
    { activity_id: 'a-cloud', participant_id: P[1], slot: 0, value: { word: 'vim' } },
    { activity_id: 'a-cloud', participant_id: P[1], slot: 1, value: { word: 'tmux' } },
    { activity_id: 'a-poll', participant_id: P[0], slot: 0, value: { option: 1 } },
    { activity_id: 'a-poll', participant_id: P[1], slot: 0, value: { option: 1 } },
    { activity_id: 'a-poll', participant_id: P[2], slot: 0, value: { option: 3 } },
    { activity_id: 'a-boss', participant_id: P[0], slot: 0, value: { passed: true, tests: 5, of: 5 } },
    { activity_id: 'a-boss', participant_id: P[2], slot: 0, value: { passed: false, tests: 3, of: 5 } },
    { activity_id: 'a-rate', participant_id: P[0], slot: 0, value: { option: 0 } },
    { activity_id: 'a-rate', participant_id: P[2], slot: 0, value: { option: 1 } },
  ],
}

test('counts people, and every activity as the screen showed it', () => {
  const r = meetingReport(input)
  assert.equal(r.month, 'November')
  assert.equal(r.date, 'Fri, 13 Nov 2026')
  assert.deepEqual(r.sections, ['Warm-up', 'Radar', 'Boss Round', 'Problem clinic', 'Wrap'])
  assert.deepEqual(r.people, { members: 2, guests: 1, total: 3 })
  assert.deepEqual(r.activities.map(a => a.prompt), ['The tool you’d refuse to give up', 'Production code to a hosted AI model?', 'Sum of the even numbers', 'What slowed you down?'])
  const [cloud, poll, boss, empty] = r.activities
  assert.deepEqual(cloud.words, [{ word: 'vim', n: 2 }, { word: 'tmux', n: 1 }])
  assert.equal(cloud.answered, 2)
  assert.deepEqual(poll.options?.map(o => [o.n, o.pct]), [[0, 0], [2, 67], [0, 0], [1, 33]])
  assert.deepEqual(boss.boss, { problem: 'Sum of the even numbers', trying: 2, passed: 1, pct: 50 })
  assert.equal(empty.empty, true)
  assert.deepEqual(empty.words, [])
})

test('the rating poll is pulled out', () => {
  const r = meetingReport(input)
  assert.equal(r.rating?.prompt, 'How was today’s meeting?')
  assert.deepEqual(r.rating?.options?.map(o => o.n), [1, 1, 0, 0])
  assert.equal(isRatingPoll({ kind: 'poll', segment_id: 'radar-poll', prompt: 'Who do we trust?' }), false)
  assert.equal(meetingReport({ ...input, activities: input.activities.filter(a => a.id !== 'a-rate') }).rating, null)
})

test('nothing in it names or identifies anyone', () => {
  const text = JSON.stringify(meetingReport(input))
  for (const secret of [USER_A, USER_B, ...P, 'Zanzibar', 'Guestname', CYCLE, 'a-cloud', 'a-poll', 'a-rate']) {
    assert.ok(!text.includes(secret), `report leaks ${secret}`)
  }
})

test('an empty meeting still reports', () => {
  const r = meetingReport({ ...input, participants: [], responses: [] })
  assert.deepEqual(r.people, { members: 0, guests: 0, total: 0 })
  assert.ok(r.activities.every(a => a.empty && a.answered === 0))
  assert.ok(r.activities.find(a => a.kind === 'poll')!.options!.every(o => o.n === 0 && o.pct === 0))
  assert.equal(meetingReport({ ...input, activities: [] }).activities.length, 0)
})

test('a busy cloud lists only the top words', () => {
  const many = Array.from({ length: 20 }, (_, i) => ({ activity_id: 'a-cloud', participant_id: `p${i}`, slot: 0, value: { word: `w${i}` } }))
  const r = meetingReport({ ...input, responses: many })
  assert.equal(r.activities[0].words?.length, REPORT_WORDS)
})

const staged: ReportInput = {
  ...input,
  agenda: [
    ...input.agenda.slice(0, 3),
    { id: 'boss-predict', slide: 'activity', section: 'Boss Round' },
    { id: 'boss-fill', slide: 'activity', section: 'Boss Round' },
    ...input.agenda.slice(3),
  ],
  activities: [
    ...input.activities,
    act('a-predict', 'boss-predict', 'predict', 'What does this print?', { options: ['3', '4', 'undefined', 'TypeError'], config: { code: 'x', answer: 1 } }),
    act('a-fill', 'boss-fill', 'fill', 'Fill the blanks', { config: { code: 'a.___()', answers: ['map'], decoys: ['filter'] } }),
  ],
  responses: [
    ...input.responses,
    { activity_id: 'a-predict', participant_id: P[0], slot: 0, value: { option: 1 } },
    { activity_id: 'a-predict', participant_id: P[1], slot: 0, value: { option: 1 } },
    { activity_id: 'a-predict', participant_id: P[2], slot: 0, value: { option: 0 } },
    { activity_id: 'a-fill', participant_id: P[0], slot: 0, value: { tokens: ['map'] } },
    { activity_id: 'a-fill', participant_id: P[1], slot: 0, value: { tokens: ['filter'] } },
  ],
}

test('Boss Round stages: % right per stage, as one card on the image', () => {
  const r = meetingReport(staged)
  assert.deepEqual(r.stages.map(s => [s.kind, s.correct, s.answered, s.pct]), [['predict', 2, 3, 67], ['fill', 1, 2, 50], ['boss', 1, 2, 50]])
  assert.deepEqual(r.activities.find(a => a.kind === 'predict')?.quiz, { correct: 2, answered: 3, pct: 67 })
  const cards = reportCards(r)
  assert.equal(cards.filter(c => c.stages).length, 1)
  assert.ok(!cards.some(c => c.kind === 'predict' || c.kind === 'fill'))
  const card = cards.find(c => c.stages)!
  assert.deepEqual(card.stages!.map(s => s.label), ['Predict the output', 'Fill the blank', 'Write it'])
  assert.equal(reportGrid(cards).rows.flatMap(x => x.cards).length, cards.length)
  // An old single Boss Round keeps its own card, and reads as "Boss Round".
  const old = meetingReport(input)
  assert.deepEqual(reportCards(old), old.activities)
  assert.deepEqual(old.stages.map(s => [s.label, s.pct]), [['Boss Round', 50]])
})

test('month recap: people, highlights, Boss %, rating; nothing when the meeting never ran', () => {
  const recap = meetingRecap(meetingReport(staged))!
  assert.deepEqual(recap.people, { members: 2, guests: 1, total: 3 })
  assert.deepEqual(recap.highlights, [
    { kind: 'cloud', prompt: 'The tool you’d refuse to give up', words: ['vim', 'tmux'], answered: 2 },
    { kind: 'poll', prompt: 'Production code to a hosted AI model?', top: 'Enterprise only', pct: 67, answered: 3 },
  ])
  assert.deepEqual(recap.stages.map(s => s.pct), [67, 50, 50])
  assert.deepEqual(recap.rating, { top: '😍 Loved it', pct: 50, answered: 2 })
  assert.equal(meetingRecap(meetingReport({ ...input, participants: [], responses: [] })), null)
  const text = JSON.stringify(recap)
  for (const secret of [USER_A, USER_B, ...P, 'Zanzibar', CYCLE]) assert.ok(!text.includes(secret), `recap leaks ${secret}`)
})
