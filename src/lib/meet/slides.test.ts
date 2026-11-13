import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { gotoPlan, navBlocked, resultsAfter, type ActivityRef } from './slides.ts'
import { activityKeyFor, cleanAgenda } from '../meeting.ts'

const file = JSON.parse(readFileSync(new URL('../../../docs/agendas/2026-11.json', import.meta.url), 'utf8'))
const agenda = cleanAgenda(file.agenda)
const acts = (status: Record<string, ActivityRef['status']>): ActivityRef[] =>
  (file.activities as { segment: string }[]).map(a => ({ id: `id-${a.segment}`, segment_id: a.segment, status: status[a.segment] ?? 'ready' }))

test('arriving on an activity slide opens its activity, once', () => {
  assert.deepEqual(gotoPlan(agenda, 'warmup-cloud', acts({})), { close: [], open: 'id-warmup-cloud' })
  // Already open (a refresh, a double press): nothing to do.
  assert.deepEqual(gotoPlan(agenda, 'warmup-cloud', acts({ 'warmup-cloud': 'open' })), { close: [], open: null })
  // Closed before: coming back doesn't reopen it by accident.
  assert.deepEqual(gotoPlan(agenda, 'warmup-cloud', acts({ 'warmup-cloud': 'closed' })), { close: [], open: null })
})

test('leaving an activity slide closes it, whichever way', () => {
  assert.deepEqual(gotoPlan(agenda, 'warmup-results', acts({ 'warmup-cloud': 'open' })), { close: ['id-warmup-cloud'], open: null })
  assert.deepEqual(gotoPlan(agenda, 'hello', acts({ 'warmup-cloud': 'open' })), { close: ['id-warmup-cloud'], open: null })
  // Jumping from one activity to the next: the old one closes, the new one opens.
  assert.deepEqual(gotoPlan(agenda, 'topic-poll', acts({ 'radar-poll': 'open' })), { close: ['id-radar-poll'], open: 'id-topic-poll' })
  // A slide that isn't an activity never opens anything.
  for (const s of agenda.filter(x => x.slide !== 'activity')) assert.equal(gotoPlan(agenda, s.id, acts({})).open, null, s.id)
  assert.deepEqual(gotoPlan(agenda, 'nope', acts({ 'boss-round': 'open' })), { close: ['id-boss-round'], open: null })
})

test('an old segment with an activity behaves like an activity slide', () => {
  const old = cleanAgenda([{ id: 'radar', kind: 'radar', title: 'Radar', detail: '', minutes: 5 }, { id: 'wrap', kind: 'wrap', title: 'Wrap', detail: '', minutes: 4 }])
  const rows: ActivityRef[] = [{ id: 'a', segment_id: 'radar', status: 'ready' }]
  assert.deepEqual(gotoPlan(old, 'radar', rows), { close: [], open: 'a' })
  assert.deepEqual(gotoPlan(old, 'wrap', [{ ...rows[0], status: 'open' }]), { close: ['a'], open: null })
})

test('slides map to their activity: own id, or a results slide its `of`', () => {
  for (const a of file.activities as { segment: string }[]) {
    const results = resultsAfter(agenda, a.segment)
    assert.ok(results, `${a.segment}: no results slide after it`)
    assert.equal(activityKeyFor(agenda, results), a.segment)
    assert.equal(activityKeyFor(agenda, a.segment), a.segment)
  }
  assert.equal(resultsAfter(agenda, 'hello'), null)
})

test('an open activity locks the slide until it closes', () => {
  const open = acts({ 'radar-poll': 'open' })
  // Back, forward past the results, a jump: all blocked while it's open.
  assert.equal(navBlocked(agenda, 'radar-poll', 'radar-news', open), true)
  assert.equal(navBlocked(agenda, 'radar-poll', 'meme-bubble', open), true)
  assert.equal(navBlocked(agenda, 'radar-poll', 'hello', open), true)
  // "Close voting" moves on to its own results slide: that goes through.
  assert.equal(navBlocked(agenda, 'radar-poll', 'radar-results', open), false)
  // Closed (in place or by Close voting): free to move.
  assert.equal(navBlocked(agenda, 'radar-poll', 'radar-news', acts({ 'radar-poll': 'closed' })), false)
  // Ready (never opened) or another slide's activity: no lock.
  assert.equal(navBlocked(agenda, 'radar-poll', 'radar-news', acts({})), false)
  assert.equal(navBlocked(agenda, 'radar-results', 'radar-news', open), false)
  assert.equal(navBlocked(agenda, 'radar-poll', 'radar-poll', open), false)
  assert.equal(navBlocked(agenda, null, 'hello', open), false)
  // Every activity in the agenda locks the same way.
  for (const a of file.activities as { segment: string }[]) {
    const o = acts({ [a.segment]: 'open' })
    assert.equal(navBlocked(agenda, a.segment, 'hello', o), true, a.segment)
    assert.equal(navBlocked(agenda, a.segment, resultsAfter(agenda, a.segment)!, o), false, a.segment)
  }
})
