import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  blankCount,
  cleanFill,
  fillChips,
  fillConfig,
  gradeFill,
  gradePredict,
  publicConfig,
  quizTally,
  splitBlanks,
  STAGE_SAMPLES,
  stageProblem,
} from './bossStages.ts'
import { aggregate, cleanResponse, type ActivityRow } from './activity.ts'
import { activityComplete, makeSlides, planActivities } from './agendaEdit.ts'
import { addAnswer, rehearseActivity, withAnswer } from './rehearse.ts'
import { DEFAULT_DURATION_S, durationFor } from './timer.ts'
import { cleanActivity } from '../meeting.ts'

const CYCLE = '11111111-1111-4111-8111-111111111111'
const row = (kind: ActivityRow['kind'], extra: Partial<ActivityRow> = {}): ActivityRow => ({
  id: `a-${kind}`, cycle_id: CYCLE, segment_id: `boss-${kind}`, kind, prompt: 'What does this print?', options: [], config: {}, status: 'open', opened_at: '2026-12-11T05:40:00Z', closed_at: null, ...extra,
})

const predict = row('predict', { options: ['3', '4', 'undefined', 'TypeError'], config: { code: 'console.log(1)', answer: 1 } })
const fill = row('fill', { config: { code: 'nums.___(f).___(g, 0)', answers: ['filter', 'reduce'], decoys: ['map', 'forEach'] } })

test('blanks: counted and split, at most two', () => {
  assert.equal(blankCount('a.___(x)'), 1)
  assert.equal(blankCount('a.___(x).____(y)'), 2)
  assert.equal(blankCount('a.___ ___ ___'), 2)
  assert.equal(blankCount('a.__(x)'), 0)
  assert.deepEqual(splitBlanks('a.___(x).___(y)'), ['a.', '(x).', '(y)'])
  assert.deepEqual(splitBlanks('no gaps'), ['no gaps'])
  assert.deepEqual(splitBlanks('___ ___ ___'), ['', ' ', ' ___'])
})

test('the right answer never leaves the server before the stage closes', () => {
  for (const status of ['ready', 'open'] as const) {
    const p = aggregate({ ...predict, status }, [])
    assert.equal('answer' in p.config, false)
    assert.equal(p.config.code, 'console.log(1)')
    assert.equal(p.tally, null)
    assert.equal(p.counts, null)
    const f = aggregate({ ...fill, status }, [])
    assert.equal('answers' in f.config, false)
    assert.equal('decoys' in f.config, false)
    assert.equal(f.config.blanks, 2)
    assert.deepEqual([...(f.config.chips as string[])].sort(), ['filter', 'forEach', 'map', 'reduce'])
    assert.ok(!JSON.stringify(p).includes('"answer"'))
    assert.ok(!JSON.stringify(f).includes('"answers"'))
  }
  assert.equal(aggregate({ ...predict, status: 'closed' }, []).config.answer, 1)
  assert.deepEqual(aggregate({ ...fill, status: 'closed' }, []).config.answers, ['filter', 'reduce'])
  // Any other kind's config goes as stored.
  assert.deepEqual(publicConfig('boss', { problem: 2 }, 'open', 'x'), { problem: 2 })
})

test('chips: right and decoys together, deduped, in an order that is not the answers first', () => {
  const chips = fillChips({ answers: ['filter', 'reduce'], decoys: ['map', 'filter', 'some'] }, 'act-1')
  assert.deepEqual([...chips].sort(), ['filter', 'map', 'reduce', 'some'])
  assert.deepEqual(fillChips({ answers: ['filter', 'reduce'], decoys: ['map', 'some'] }, 'act-1'), chips)
  // Stable for one activity, and it varies across seeds.
  const orders = new Set(['a', 'b', 'c', 'd', 'e', 'f'].map(seed => fillChips({ answers: ['filter', 'reduce'], decoys: ['map', 'some'] }, seed).join()))
  assert.ok(orders.size > 1)
})

test('fill answers: one offered chip per blank, else refused', () => {
  const cfg = fillConfig(fill.config)
  assert.deepEqual(cleanFill(cfg, { tokens: ['map', 'reduce'] }), ['map', 'reduce'])
  assert.equal(cleanFill(cfg, { tokens: ['map'] }), null)
  assert.equal(cleanFill(cfg, { tokens: ['map', 'eval'] }), null)
  assert.equal(cleanFill(cfg, { tokens: 'map,reduce' }), null)
  assert.equal(cleanFill(fillConfig({ code: 'no gaps', answers: [] }), { tokens: [] }), null)
  assert.deepEqual(cleanResponse(fill, { tokens: [' filter ', 'reduce'] }), { ok: true, value: { tokens: ['filter', 'reduce'] } })
  assert.equal(cleanResponse(fill, { tokens: ['filter'] }).ok, false)
  assert.deepEqual(cleanResponse(predict, { option: 3 }), { ok: true, value: { option: 3 } })
  assert.equal(cleanResponse(predict, { option: 4 }).ok, false)
})

test('grading: exact tokens in order, the right tile', () => {
  assert.equal(gradeFill(['filter', 'reduce'], ['filter', 'reduce']), true)
  assert.equal(gradeFill(['reduce', 'filter'], ['filter', 'reduce']), false)
  assert.equal(gradeFill(['filter'], ['filter', 'reduce']), false)
  assert.equal(gradeFill(['x'], ['']), false)
  assert.equal(gradePredict(1, 1), true)
  assert.equal(gradePredict('1', 1), true)
  assert.equal(gradePredict(0, 1), false)
  assert.equal(gradePredict(1, null), false)
})

test('a closed stage scores % right, one answer per person, anonymous', () => {
  const rows = [
    { participant_id: 'p1', slot: 0, value: { option: 1 } },
    { participant_id: 'p2', slot: 0, value: { option: 0 } },
    { participant_id: 'p3', slot: 0, value: { option: 1 } },
    { participant_id: 'p3', slot: 0, value: { option: 0 } }, // a duplicate never counts twice
  ]
  const closed = aggregate({ ...predict, status: 'closed' }, rows)
  // The right tile's share, as the tiles round it (2 of 3: 67, never 66 beside a 67% tile).
  assert.deepEqual(closed.tally, { correct: 2, answered: 3, pct: 67 })
  assert.deepEqual(closed.counts, [1, 2, 0, 0])
  const open = aggregate(predict, rows)
  assert.equal(open.answered, 3)
  assert.equal(open.tally, null)
  const f = quizTally('fill', fill.config, [
    { participant_id: 'p1', slot: 0, value: { tokens: ['filter', 'reduce'] } },
    { participant_id: 'p2', slot: 0, value: { tokens: ['map', 'reduce'] } },
  ])
  assert.deepEqual(f, { correct: 1, answered: 2, pct: 50 })
  assert.deepEqual(quizTally('fill', fill.config, []), { correct: 0, answered: 0, pct: 0 })
})

test('each stage has its own default time', () => {
  assert.equal(DEFAULT_DURATION_S.predict, 60)
  assert.equal(DEFAULT_DURATION_S.fill, 90)
  assert.equal(DEFAULT_DURATION_S.boss, 300)
  assert.equal(durationFor('fill', { duration_s: 45 }), 45)
})

test('+ Add › Boss Round: three stages, each followed by its results', () => {
  const slides = makeSlides('boss', [{ id: 'boss-predict' }])
  assert.deepEqual(slides.map(s => s.slide), ['activity', 'results', 'activity', 'results', 'activity', 'results'])
  assert.deepEqual(slides.filter(s => s.activity).map(s => s.activity!.kind), ['predict', 'fill', 'boss'])
  assert.ok(slides.every(s => s.kind === 'boss' && s.section === 'Boss Round'))
  assert.equal(new Set(slides.map(s => s.id)).size, 6)
  assert.ok(!slides.some(s => s.id === 'boss-predict'))
  for (let i = 0; i < 6; i += 2) assert.equal(slides[i + 1].of, slides[i].id)
  // The samples are complete: saving writes all three rows.
  const plan = planActivities(slides, [])
  assert.deepEqual(plan.insert.map(r => r.kind), ['predict', 'fill', 'boss'])
  assert.deepEqual(plan.incomplete, [])
})

test('a stage is written only once it is complete', () => {
  const p = { kind: 'predict' as const, prompt: 'What prints?', options: ['a', 'b', 'c'], config: { code: 'x', answer: 2 } }
  assert.ok(activityComplete(p))
  assert.equal(activityComplete({ ...p, config: { code: 'x' } }), null)
  assert.equal(activityComplete({ ...p, config: { code: '', answer: 0 } }), null)
  assert.equal(activityComplete({ ...p, options: ['a', '', 'c'] }), null) // a gap would move the answer
  const f = { kind: 'fill' as const, prompt: 'Fill it', config: { code: 'a.___()', answers: ['map'], decoys: [] } }
  assert.ok(activityComplete(f))
  assert.equal(activityComplete({ ...f, config: { code: 'a.map()', answers: ['map'] } }), null)
  assert.equal(activityComplete({ ...f, config: { code: 'a.___().___()', answers: ['map'] } }), null)
  assert.equal(stageProblem('predict', ['a'], { code: 'x', answer: 0 }), 'It needs at least two answers.')
  assert.equal(stageProblem('boss', [], {}), null)
  // The agenda keeps a predict stage's tiles.
  assert.deepEqual(cleanActivity({ kind: 'predict', prompt: 'Q', options: ['1', '2'], config: { code: 'x', answer: 0 } })?.options, ['1', '2'])
  assert.equal(cleanActivity({ kind: 'fill', prompt: 'Q', options: ['1', '2'] })?.options, undefined)
})

test('rehearsal: the answer hides until closed, then a sample score; the phone preview locks and grades', () => {
  const a = { id: 'local:p', segmentId: 'p', kind: 'predict' as const, prompt: 'Q', options: [...STAGE_SAMPLES.predict.options], config: { ...STAGE_SAMPLES.predict.config }, status: 'ready' as const, openedAt: null, closedAt: null, closesAt: null, answered: 0, total: 0, counts: null, words: null, tally: null }
  const t0 = Date.parse('2026-12-11T05:40:00Z')
  const open = rehearseActivity(a, { status: 'open', openedAt: new Date(t0).toISOString() }, t0 + 30_000)
  assert.equal('answer' in open.config, false)
  assert.equal(open.tally, null)
  const closed = rehearseActivity(a, { status: 'closed', openedAt: new Date(t0).toISOString() }, t0 + 30_000)
  assert.equal(closed.config.answer, 1)
  assert.equal(closed.counts!.reduce((x, y) => x + y, 0), closed.answered)
  assert.equal(closed.counts![1], closed.tally!.correct)
  const mine = addAnswer('predict', [], { option: 1 })
  assert.deepEqual(addAnswer('predict', mine, { option: 2 }), mine)
  const withMine = withAnswer(closed, mine, a.config)
  assert.equal(withMine.tally!.correct, closed.tally!.correct + 1)
  assert.equal(withMine.answered, closed.answered + 1)
  // A cheer never replaces the write stage's last run.
  const run = [{ passed: true, tests: 6, of: 6 }]
  assert.deepEqual(addAnswer('boss', run, { cheer: true }), run)
})
