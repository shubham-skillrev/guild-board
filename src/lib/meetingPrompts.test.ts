import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { AGENDA_SYSTEM, exampleFor, PREP_SYSTEM, type ReferenceAgenda } from './meetingPrompts.ts'
import { cleanAgenda } from './meeting.ts'

const guide = readFileSync(new URL('../../docs/07-agenda-and-script-guide.md', import.meta.url), 'utf8')
type Prep = { points: string[]; opener: string; by: string; at: string | null; ask: string[] }
type Stored = {
  id: string
  kind: string
  slide: string
  section: string
  of?: string
  meme?: { src?: string; panels?: { label: string; text: string; face: string }[]; caption?: string }
  title: string
  detail: string
  minutes: number
  topicIds: string[]
  cue?: string
  cards?: { kind: string; url?: string }[]
  prep: Prep | null
}
const reference = JSON.parse(readFileSync(new URL('../../docs/agendas/2026-11.json', import.meta.url), 'utf8')) as Omit<ReferenceAgenda, 'agenda'> & { agenda: Stored[] }

test('the guide quotes both system prompts word for word', () => {
  assert.ok(guide.includes(AGENDA_SYSTEM), 'AGENDA_SYSTEM differs from docs/07')
  assert.ok(guide.includes(PREP_SYSTEM), 'PREP_SYSTEM differs from docs/07')
})

test('the reference agenda survives cleanAgenda unchanged', () => {
  const cleaned = cleanAgenda(reference.agenda)
  // cleanAgenda drops the (empty) `ask`; everything else must come through untouched.
  const withoutAsk = reference.agenda.map(({ prep, ...s }) => {
    if (!prep) return { ...s, prep: null }
    const { ask: _ask, ...rest } = prep
    return { ...s, prep: rest }
  })
  assert.deepEqual(cleaned, withoutAsk)
})

test('the reference meets its own standard', () => {
  const byId = new Map(reference.agenda.map(s => [s.id, s]))
  const kinds = ['title', 'content', 'activity', 'results', 'text', 'meme']
  for (const s of reference.agenda) {
    assert.ok(kinds.includes(s.slide), `${s.id}: slide kind`)
    assert.ok(s.section, `${s.id}: section`)
    assert.equal(s.minutes, 0, `${s.id}: slides aren't timed`)
    if (s.slide !== 'meme') {
      assert.ok(s.title && s.title.length < 60, `${s.id}: title missing or too long`)
      assert.ok(s.cue && s.cue.length <= 90, `${s.id}: cue missing or over 90`)
    }
    assert.ok(s.detail.length < 300, `${s.id}: detail too long`)
    if (s.slide === 'activity') assert.equal((reference.activities ?? []).filter(a => a.segment === s.id).length, 1, `${s.id}: exactly one activity`)
    if (s.slide === 'results') assert.equal(byId.get(s.of ?? '')?.slide, 'activity', `${s.id}: of must be an activity slide`)
    for (const c of s.cards ?? []) {
      assert.notEqual(c.kind, 'slot', `${s.id}: no slot cards`)
      if (c.kind === 'news') assert.match(c.url ?? '', /^https:\/\//, `${s.id}: news card without a link`)
    }
    if (s.prep) {
      assert.ok(s.prep.opener.length < 200, `${s.id}: opener too long`)
      assert.ok(s.prep.points.length <= 3, `${s.id}: up to 3 points`)
      for (const p of s.prep.points) assert.ok(p.length < 180, `${s.id}: point too long`)
      // Who to ask is never committed.
      assert.deepEqual(s.prep.ask, [])
    }
    if (s.slide === 'meme') assert.equal(s.prep, null, `${s.id}: memes carry no notes`)
  }
  const memes = reference.agenda.filter(s => s.slide === 'meme')
  assert.ok(memes.length >= 2 && memes.length <= 4, '2-4 memes')
  for (const m of memes) {
    assert.ok(!m.meme?.src, `${m.id}: November's memes are Kers memes, no images`)
    assert.ok(m.meme?.panels?.length, `${m.id}: Kers panels`)
  }
  for (const a of reference.activities ?? []) {
    assert.equal(byId.get(a.segment)?.slide, 'activity', `${a.segment}: not an activity slide`)
    if (a.kind === 'poll') assert.ok(a.options!.length >= 2 && a.options!.length <= 4, `${a.segment}: 2-4 options`)
  }
})

test('exampleFor carries the activity and only adds prep when asked', () => {
  const withPrep = exampleFor(reference, true)
  const without = exampleFor(reference, false)
  assert.match(withPrep, /AI by 2028\?/)
  assert.match(withPrep, /opener/)
  assert.doesNotMatch(without, /opener/)
  // The agenda model sees the slides it has to write.
  assert.match(without, /"cue"/)
  assert.match(without, /"note"/)
  assert.match(without, /"slide": "meme"/)
  assert.match(without, /"panels"/)
})
