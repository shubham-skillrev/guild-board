import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { activityKeyFor, cleanAgenda, cleanCards, cleanMeme, earlyStartWarning, MEET_LEAD_MS, MEET_LIVE_MAX_MS, meetingLive, phoneAgenda, publicSegments, sectionsOf, segmentCards, slideKind } from './meeting.ts'

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

const stored = JSON.parse(readFileSync(new URL('../../docs/agendas/2026-11.json', import.meta.url), 'utf8')).agenda as { id: string; cue?: string; prep: { points: string[]; opener: string; ask: string[] } | null }[]
// Notes that aren't also the slide's public cue (Kers' Boss line is both, on purpose).
const cues = new Set(stored.map(s => s.cue))
const secrets = stored.flatMap(s => (s.prep ? [...s.prep.points, s.prep.opener] : [])).filter(t => !cues.has(t))

test('phones: the cards go to everyone, the presenter notes only to who presents', () => {
  // As GET /api/meet builds it for a member, a guest (no id) and another admin.
  for (const viewer of ['member-1', null, 'other-admin']) {
    const view = JSON.stringify(phoneAgenda(stored, viewer, 'presenter-1'))
    for (const s of secrets) assert.ok(!view.includes(s), `leaked to ${viewer}: ${s}`)
    assert.equal(phoneAgenda(stored, viewer, 'presenter-1').notes, null)
  }
  // No presenter yet: nobody gets notes, not even a viewer whose id is empty.
  assert.equal(phoneAgenda(stored, null, null).notes, null)
  assert.equal(phoneAgenda(stored, '', '').notes, null)
  const mine = phoneAgenda(stored, 'presenter-1', 'presenter-1')
  const news = stored.find(s => s.id === 'radar-news')!
  assert.deepEqual(mine.notes?.['radar-news'].points, news.prep!.points)
  // A meme has no notes.
  assert.equal(mine.notes?.['meme-trust'], undefined)
  // Even for the presenter, the public agenda itself carries no prep.
  assert.ok(mine.agenda.every(s => !('prep' in s)))
  assert.ok(!JSON.stringify(mine.agenda).includes('"ask"'))
})

test('cards: unknown kinds, bad links and over-long text are cut', () => {
  const cards = cleanCards([
    { kind: 'news', title: 'T', source: 'S', url: 'javascript:alert(1)', why: 'w' },
    { kind: 'news', title: 'T2', source: 'S', url: 'https://example.com/a', why: 'x'.repeat(500) },
    { kind: 'post', postId: 'not-a-uuid' },
    // Spotlight slots are gone: dropped like any unknown kind.
    { kind: 'slot', label: 'Spotlight', status: 'invited' },
    { kind: 'side', label: 'A' },
    { kind: 'poll' },
  ])
  assert.deepEqual(cards[0], { kind: 'news', title: 'T', source: 'S', why: 'w' })
  assert.equal(cards[1].kind === 'news' && cards[1].url, 'https://example.com/a')
  assert.equal(cards[1].kind === 'news' && cards[1].why.length, 180)
  assert.equal(cards.length, 2)
})

test('an agenda from before cards: its posts become post cards, its detail stays', () => {
  const old = cleanAgenda([{ id: 'topic', kind: 'topic', title: 'T', detail: 'D', minutes: 5, topicIds: ['61f7a2f7-621b-4b74-b406-39f95844a935'] }])
  assert.equal(old[0].cue, undefined)
  assert.equal(old[0].cards, undefined)
  assert.deepEqual(segmentCards(old[0]), [{ kind: 'post', postId: '61f7a2f7-621b-4b74-b406-39f95844a935' }])
  assert.equal(publicSegments(old)[0].detail, 'D')
})

test('an old segment agenda still renders: one slide each', () => {
  const old = cleanAgenda([
    { id: 'warmup', kind: 'warmup', title: 'Warm-up', detail: 'D', minutes: 2 },
    { id: 'radar', kind: 'radar', title: 'Radar', detail: 'D', minutes: 5 },
  ])
  assert.equal(old[0].slide, undefined)
  assert.equal(old[0].minutes, 2)
  // Each old segment is its own section, and its own activity's slide.
  assert.deepEqual(sectionsOf(old).map(s => [s.title, s.start, s.slides]), [['Warm-up', 0, 1], ['Radar', 1, 1]])
  assert.equal(slideKind(old[0], true), 'activity')
  assert.equal(slideKind(old[1], false), 'content')
  assert.equal(activityKeyFor(old, 'radar'), 'radar')
})

test('cleanAgenda keeps slides: kind, section, results `of`, memes, untimed', () => {
  const a = cleanAgenda([
    { id: 'p', kind: 'radar', slide: 'activity', section: 'Radar', title: 'Vote', minutes: 0 },
    { id: 'r', kind: 'radar', slide: 'results', section: 'Radar', of: 'p', title: 'Results', minutes: 0 },
    { id: 'm', kind: 'topic', slide: 'meme', section: 'Topic', meme: { panels: [{ label: 'A', text: 'x', face: 'nope' }, { text: '' }], caption: 'c' } },
    { id: 'i', kind: 'topic', slide: 'meme', section: 'Topic', meme: { src: 'https://evil.example/x.png' } },
    { id: 'x', kind: 'topic', slide: 'wobble', of: 'p', title: 'T' },
  ])
  assert.equal(a[0].slide, 'activity')
  assert.equal(a[0].minutes, 0)
  assert.equal(a[1].of, 'p')
  assert.deepEqual(a[2].meme, { panels: [{ label: 'A', text: 'x', face: 'smug' }], caption: 'c' })
  assert.equal(a[2].title, '')
  // An image from anywhere but /meet/memes/ is dropped, and an empty meme with it.
  assert.equal(a[3].meme, undefined)
  // Unknown slide kind: an old segment; `of` only on results.
  assert.equal(a[4].slide, undefined)
  assert.equal(a[4].of, undefined)
  assert.deepEqual(sectionsOf(a).map(s => [s.title, s.slides]), [['Radar', 2], ['Topic', 2], ['T', 1]])
  assert.equal(activityKeyFor(a, 'r'), 'p')
  assert.equal(activityKeyFor(a, 'p'), 'p')
  assert.deepEqual(cleanMeme({ src: '/meet/memes/cat.png', alt: 'A cat' }), { src: '/meet/memes/cat.png', alt: 'A cat' })
  assert.equal(cleanMeme({ src: '/meet/memes/../secret.png' }), null)
})

test('November: every slide reaches phones without notes, memes included', () => {
  const view = phoneAgenda(stored, 'member-1', 'presenter-1')
  assert.equal(view.agenda.length, stored.length)
  assert.ok(view.agenda.some(s => s.slide === 'meme' && s.meme?.panels?.length))
  assert.ok(view.agenda.every(s => !('prep' in s)))
})
