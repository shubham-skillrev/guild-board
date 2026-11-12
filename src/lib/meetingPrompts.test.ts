import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { AGENDA_SYSTEM, exampleFor, PREP_SYSTEM, type ReferenceAgenda } from './meetingPrompts.ts'
import { cleanAgenda, totalMinutes } from './meeting.ts'

const guide = readFileSync(new URL('../../docs/07-agenda-and-script-guide.md', import.meta.url), 'utf8')
type Stored = { id: string; kind: string; title: string; detail: string; minutes: number; topicIds: string[]; prep: { points: string[]; opener: string; by: string; at: string | null; ask: string[] } }
const reference = JSON.parse(readFileSync(new URL('../../docs/agendas/2026-11.json', import.meta.url), 'utf8')) as Omit<ReferenceAgenda, 'agenda'> & { agenda: Stored[] }

test('the guide quotes both system prompts word for word', () => {
  assert.ok(guide.includes(AGENDA_SYSTEM), 'AGENDA_SYSTEM differs from docs/07')
  assert.ok(guide.includes(PREP_SYSTEM), 'PREP_SYSTEM differs from docs/07')
})

test('the reference agenda survives cleanAgenda unchanged and fills 60 minutes', () => {
  const cleaned = cleanAgenda(reference.agenda)
  // cleanAgenda drops the (empty) `ask`; everything else must come through untouched.
  const withoutAsk = reference.agenda.map(({ prep: { ask: _ask, ...prep }, ...s }) => ({ ...s, prep }))
  assert.deepEqual(cleaned, withoutAsk)
  assert.equal(totalMinutes(cleaned), 60)
})

test('the reference meets its own standard', () => {
  for (const s of reference.agenda) {
    const prep = s.prep
    assert.ok(prep.opener.length < 200, `${s.id}: opener too long`)
    assert.ok(prep.points.length >= 2 && prep.points.length <= 3, `${s.id}: 2-3 points`)
    for (const p of prep.points) assert.ok(p.length < 180, `${s.id}: point too long`)
    assert.ok(s.title.length < 60, `${s.id}: title too long`)
    assert.ok(s.detail.length < 300, `${s.id}: detail too long`)
  }
  // Who to ask is never committed.
  for (const s of reference.agenda) assert.deepEqual(s.prep.ask, [])
  for (const a of reference.activities ?? []) {
    assert.ok(reference.agenda.some(s => s.id === a.segment), `${a.segment}: no such segment`)
    if (a.kind === 'poll') assert.ok(a.options!.length >= 2 && a.options!.length <= 4, `${a.segment}: 2-4 options`)
  }
})

test('exampleFor carries the activity and only adds prep when asked', () => {
  const withPrep = exampleFor(reference, true)
  const without = exampleFor(reference, false)
  assert.match(withPrep, /AI by 2028\?/)
  assert.match(withPrep, /opener/)
  assert.doesNotMatch(without, /opener/)
})
