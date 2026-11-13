import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  activityComplete,
  commit,
  editLocked,
  insertAfter,
  makeSlides,
  moveSlide,
  planActivities,
  redo,
  rehearsalActivities,
  removeSlide,
  startHistory,
  undo,
  uniqueId,
  updateSlide,
  withActivities,
  COALESCE_MS,
  UNDO_LIMIT,
  type ActivityRowLite,
} from './agendaEdit.ts'
import { cleanAgenda, cleanMeme, type Segment } from '../meeting.ts'

const seg = (id: string, extra: Partial<Segment> = {}): Segment => ({ id, kind: 'custom', slide: 'text', title: id, detail: '', minutes: 0, topicIds: [], prep: null, ...extra })
const ids = (a: { id: string }[]) => a.map(s => s.id)

test('uniqueId never repeats an id on the agenda', () => {
  const a = [seg('poll'), seg('poll-2')]
  assert.equal(uniqueId(a, 'poll'), 'poll-3')
  assert.equal(uniqueId(a, 'Word Cloud!'), 'word-cloud')
  assert.ok(uniqueId(a, 'x'.repeat(80)).length <= 40)
})

test('adding a poll or word cloud inserts its results slide right after it', () => {
  const agenda = [seg('a', { section: 'Radar', kind: 'radar' }), seg('b')]
  for (const kind of ['poll', 'cloud'] as const) {
    const added = makeSlides(kind, agenda, { section: 'Radar', kind: 'radar' })
    assert.equal(added.length, 2)
    const [act, res] = added
    assert.equal(act.slide, 'activity')
    assert.equal(act.activity?.kind, kind)
    assert.equal(res.slide, 'results')
    assert.equal(res.of, act.id)
    assert.equal(act.section, 'Radar')
    const next = insertAfter(agenda, 'a', added)
    assert.deepEqual(ids(next), ['a', act.id, res.id, 'b'])
    // Survives the server's cleaning, activity and all.
    const clean = cleanAgenda(next)
    assert.equal(clean[1].activity?.kind, kind)
    assert.equal(clean[2].of, act.id)
  }
  // A new poll is complete out of the box (two options), so it gets its row on the first save.
  assert.ok(activityComplete(makeSlides('poll', [])[0].activity))
})

test('topic, text, title and meme slides', () => {
  const [topic] = makeSlides('topic', [], { post: { id: '11111111-1111-4111-8111-111111111111', title: 'Monorepo or not?' } })
  assert.equal(topic.slide, 'content')
  assert.equal(topic.title, 'Monorepo or not?')
  assert.deepEqual(topic.cards, [{ kind: 'post', postId: '11111111-1111-4111-8111-111111111111' }])
  assert.deepEqual(topic.topicIds, ['11111111-1111-4111-8111-111111111111'])
  assert.equal(makeSlides('text', [])[0].slide, 'text')
  assert.equal(makeSlides('title', [])[0].slide, 'title')
  const [meme] = makeSlides('meme', [])
  assert.equal(meme.slide, 'meme')
  assert.ok(cleanAgenda([meme])[0].meme?.panels?.length)
  // Inserted at the end when there's nothing to insert after.
  assert.deepEqual(ids(insertAfter([seg('a')], null, [seg('z')])), ['a', 'z'])
})

test('uploaded meme images: only our bucket', () => {
  assert.ok(cleanMeme({ src: 'https://abcd.supabase.co/storage/v1/object/public/meeting-memes/x-1.png' })?.src)
  assert.ok(cleanMeme({ src: '/meet/memes/cat.webp' })?.src)
  assert.equal(cleanMeme({ src: 'https://evil.example/x.png' }), null)
  assert.equal(cleanMeme({ src: 'https://abcd.supabase.co/storage/v1/object/public/other/x.png' }), null)
})

test('reorder moves one slide and clamps', () => {
  const a = ['a', 'b', 'c', 'd']
  assert.deepEqual(moveSlide(a, 0, 2), ['b', 'c', 'a', 'd'])
  assert.deepEqual(moveSlide(a, 3, 0), ['d', 'a', 'b', 'c'])
  assert.deepEqual(moveSlide(a, 1, 99), ['a', 'c', 'd', 'b'])
  assert.equal(moveSlide(a, 9, 0), a)
  assert.equal(moveSlide(a, 2, 2), a)
})

test('deleting an activity slide takes its results slides; others go alone', () => {
  const a = [seg('p', { slide: 'activity', activity: { kind: 'poll', prompt: 'Q', options: ['a', 'b'] } }), seg('r', { slide: 'results', of: 'p' }), seg('t')]
  assert.deepEqual(ids(removeSlide(a, 'p')), ['t'])
  assert.deepEqual(ids(removeSlide(a, 'r')), ['p', 't'])
  assert.deepEqual(ids(removeSlide(a, 'nope')), ['p', 'r', 't'])
  assert.equal(updateSlide(a, 't', { title: 'New' })[2].title, 'New')
})

test('undo keeps the last 20 changes; typing in one field is one change', () => {
  let h = startHistory(0)
  for (let i = 1; i <= 30; i++) h = commit(h, i, null, i * 10_000)
  assert.equal(h.past.length, UNDO_LIMIT)
  for (let i = 0; i < 25; i++) h = undo(h)
  assert.equal(h.present, 10)
  h = redo(h)
  assert.equal(h.present, 11)

  let t = startHistory('')
  t = commit(t, 'h', 'title:a', 1000)
  t = commit(t, 'he', 'title:a', 1000 + COALESCE_MS / 2)
  t = commit(t, 'hey', 'title:a', 1000 + COALESCE_MS)
  assert.equal(t.past.length, 1)
  assert.equal(undo(t).present, '')
  // Another field, or a pause, is a new change.
  t = commit(t, 'hey!', 'cue:a', 1000 + COALESCE_MS + 10)
  assert.equal(t.past.length, 2)
  t = commit(t, 'hey!!', 'cue:a', 1000 + COALESCE_MS * 5)
  assert.equal(t.past.length, 3)
  // A change clears redo.
  const u = commit(undo(t), 'other', null, 99_999)
  assert.deepEqual(u.future, [])
})

test('locked while live or while a live rehearsal runs, open again after End', () => {
  const now = Date.parse('2026-12-10T12:00:00Z')
  const at = (min: number) => new Date(now - min * 60_000).toISOString()
  assert.equal(editLocked({ startedAt: null, endedAt: null }, now), false)
  assert.equal(editLocked({ startedAt: at(5), endedAt: null }, now), true)
  assert.equal(editLocked({ startedAt: at(50), endedAt: at(5) }, now), false)
  assert.equal(editLocked({ startedAt: null, endedAt: null, rehearsalCode: 'x'.repeat(32), rehearsalStartedAt: at(5) }, now), true)
  // One left running from long ago doesn't lock it forever.
  assert.equal(editLocked({ startedAt: at(60 * 9), endedAt: null }, now), false)
})

const row = (segment_id: string, extra: Partial<ActivityRowLite> = {}): ActivityRowLite => ({ id: `row-${segment_id}`, segment_id, kind: 'poll', prompt: 'Q', options: ['a', 'b'], config: {}, status: 'ready', ...extra })
const act = (id: string, a: Segment['activity']) => seg(id, { slide: 'activity', activity: a })

test('saving creates and updates activity rows', () => {
  const agenda = [act('new', { kind: 'cloud', prompt: 'One word' }), act('same', { kind: 'poll', prompt: 'Q', options: ['a', 'b'] }), act('edit', { kind: 'poll', prompt: 'Q2', options: ['a', 'b', 'c'] })]
  const plan = planActivities(agenda, [row('same', { config: {} }), row('edit')])
  assert.deepEqual(plan.insert, [{ segment_id: 'new', kind: 'cloud', prompt: 'One word', options: [], config: {} }])
  assert.deepEqual(plan.update, [{ id: 'row-edit', patch: { kind: 'poll', prompt: 'Q2', options: ['a', 'b', 'c'], config: {} } }])
  assert.deepEqual(plan.remove, [])
})

test('incomplete activities wait; legacy slides keep their seeded row', () => {
  const agenda = [act('half', { kind: 'poll', prompt: 'Q', options: ['only one', ' '] }), act('blank', { kind: 'cloud', prompt: '  ' }), seg('legacy', { slide: 'activity' })]
  const plan = planActivities(agenda, [row('legacy', { kind: 'boss', prompt: 'Boss', config: { problem: 1 } })])
  assert.deepEqual(plan.incomplete, ['half', 'blank'])
  assert.deepEqual(plan.insert, [])
  assert.deepEqual(plan.remove, [])
  assert.deepEqual(plan.update, [])
})

test('a deleted activity slide drops its row only when nobody answered', () => {
  const rows = [row('gone'), row('answered'), row('open', { status: 'open' }), row('now-text')]
  const agenda = [seg('now-text')]
  const plan = planActivities(agenda, rows, { 'row-answered': 3 })
  assert.deepEqual(plan.remove.sort(), ['row-gone', 'row-now-text'])
  assert.deepEqual(plan.kept.sort(), ['answered', 'open'])
})

test('an answered activity only takes a prompt fix, never new options', () => {
  const agenda = [act('p', { kind: 'poll', prompt: 'Fixed typo', options: ['x', 'y'] })]
  const plan = planActivities(agenda, [row('p', { options: ['a', 'b'] })], { 'row-p': 2 })
  assert.deepEqual(plan.update, [{ id: 'row-p', patch: { prompt: 'Fixed typo' } }])
  assert.deepEqual(plan.kept, ['p'])
})

test('config key order from jsonb is not a change', () => {
  const agenda = [act('b', { kind: 'boss', prompt: 'Boss', config: { a: 1, problem: 2 } })]
  const plan = planActivities(agenda, [row('b', { kind: 'boss', prompt: 'Boss', options: [], config: { problem: 2, a: 1 } })])
  assert.deepEqual(plan.update, [])
})

test('the editor starts from rows for an agenda that predates it', () => {
  const agenda = [seg('x', { slide: 'activity' }), seg('y', { slide: 'activity', activity: { kind: 'cloud', prompt: 'Mine' } }), seg('z')]
  const filled = withActivities(agenda, [row('x', { options: ['a', 'b', 7] }), row('y'), row('z')])
  assert.deepEqual(filled[0].activity, { kind: 'poll', prompt: 'Q', options: ['a', 'b'] })
  assert.equal(filled[1].activity?.prompt, 'Mine')
  assert.equal(filled[2].activity, undefined)

  const rehearsal = rehearsalActivities(filled, {})
  assert.deepEqual(Object.keys(rehearsal).sort(), ['x', 'y'])
  assert.equal(rehearsal.y.kind, 'cloud')
  assert.equal(rehearsal.x.status, 'ready')
})
