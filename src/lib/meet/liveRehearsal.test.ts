import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { MEET_LEAD_MS, MEET_LIVE_MAX_MS, meetingDone, meetingLive } from '../meeting.ts'
import {
  newRehearsalCode,
  realMeetingRan,
  REHEARSAL_CODE_RE,
  rehearsalAccess,
  rehearsalBlocked,
  rehearsalLeft,
  rehearsalOn,
  rehearsalPath,
  rehearsalWipeMode,
  roomOpenTo,
  rowRehearsing,
  wipeRehearsal,
  resetActivities,
} from './liveRehearsal.ts'

const now = Date.parse('2026-11-12T15:00:00Z')
const meetingAt = '2026-11-13T05:30:00Z'
const ago = (ms: number) => new Date(now - ms).toISOString()
const code = newRehearsalCode()
const running = { startedAt: null, endedAt: null, rehearsalCode: code, rehearsalStartedAt: ago(60_000) }

test('codes: unguessable, well-formed, unique', () => {
  assert.match(code, REHEARSAL_CODE_RE)
  assert.equal(code.length, 32)
  assert.notEqual(newRehearsalCode(), code)
  assert.equal(rehearsalPath(code), `/meet?r=${code}`)
})

test('rehearsalOn: a code and a start, not left running for 8 h', () => {
  assert.equal(rehearsalOn(running, now), true)
  assert.equal(rehearsalOn({ ...running, rehearsalCode: null }, now), false)
  assert.equal(rehearsalOn({ ...running, rehearsalStartedAt: null }, now), false)
  assert.equal(rehearsalOn({ ...running, rehearsalStartedAt: ago(MEET_LIVE_MAX_MS + 1) }, now), false)
  assert.equal(rehearsalOn(null, now), false)
  // A stale one is still "left" (the real Start wipes it).
  assert.equal(rehearsalLeft({ ...running, rehearsalStartedAt: ago(MEET_LIVE_MAX_MS + 1) }), true)
  assert.equal(rehearsalLeft({ rehearsalCode: null, rehearsalStartedAt: null }), false)
})

test('a rehearsal is never live: no banner, meetingDone untouched', () => {
  // /api/meet/live and the banner ask meetingLive (via room.ts isLive) only.
  assert.equal(meetingLive(running, now), false)
  assert.equal(meetingDone(running, meetingAt), false)
  const live = readFileSync(new URL('../../app/api/meet/live/route.ts', import.meta.url), 'utf8')
  assert.match(live, /const live = isLive\(m\?\.row\)/)
  assert.doesNotMatch(live, /roomOpenTo|rehearsal_code|rowRehearsing/)
  const room = readFileSync(new URL('./room.ts', import.meta.url), 'utf8')
  assert.match(room, /export function isLive\([^)]*\)[^{]*\{\s*return meetingLive\(m \? \{ startedAt: m\.started_at, endedAt: m\.ended_at \} : null, now\)/)
})

test('joining a rehearsal needs its code', () => {
  const row = { started_at: null, ended_at: null, rehearsal_code: code, rehearsal_started_at: ago(60_000) }
  assert.equal(rowRehearsing(row, now), true)
  assert.equal(roomOpenTo(row, code, now), true)
  assert.equal(roomOpenTo(row, undefined, now), false)
  assert.equal(roomOpenTo(row, '', now), false)
  assert.equal(roomOpenTo(row, newRehearsalCode(), now), false)
  assert.equal(roomOpenTo(row, code.slice(0, -1), now), false)
  assert.equal(roomOpenTo(row, `${code}x`, now), false)
  // An ended (wiped) rehearsal: the old code opens nothing.
  assert.equal(roomOpenTo({ ...row, rehearsal_code: null, rehearsal_started_at: null }, code, now), false)
  assert.equal(rehearsalAccess({ rehearsalCode: code, rehearsalStartedAt: ago(MEET_LIVE_MAX_MS + 1) }, code, now), false)
  // The live meeting is open to everyone, code or not.
  assert.equal(roomOpenTo({ started_at: ago(60_000), ended_at: null }, undefined, now), true)
  // The API checks it before join and respond; the page and GET pass the cookie.
  const api = readFileSync(new URL('../../app/api/meet/route.ts', import.meta.url), 'utf8')
  assert.match(api, /if \(!m\?\.row \|\| !roomOpenTo\(m\.row, code\)\) return/)
  assert.ok(api.indexOf('roomOpenTo(m.row, code)') < api.indexOf("case 'join'"))
})

test('rehearsalBlocked: not while live, not once the real meeting ran', () => {
  assert.equal(rehearsalBlocked({ startedAt: null, endedAt: null }, meetingAt, now), null)
  assert.match(rehearsalBlocked({ startedAt: ago(60_000), endedAt: null }, meetingAt, now) ?? '', /live/)
  // The real meeting started on time and ended.
  const after = Date.parse(meetingAt) + 3 * 3_600_000
  assert.match(rehearsalBlocked({ startedAt: meetingAt, endedAt: new Date(after - 3_600_000).toISOString() }, meetingAt, after) ?? '', /already run/)
  // ...or started and was never ended (stale after 8 h): still counts as run.
  assert.match(rehearsalBlocked({ startedAt: meetingAt, endedAt: null }, meetingAt, Date.parse(meetingAt) + MEET_LIVE_MAX_MS + 1) ?? '', /already run/)
  // A dry run the day before (start + End, more than 3 h early) doesn't block.
  const dry = { startedAt: ago(3_600_000), endedAt: ago(3_000_000) }
  assert.equal(realMeetingRan(dry, meetingAt), false)
  assert.equal(rehearsalBlocked(dry, meetingAt, now), null)
  assert.equal(realMeetingRan({ startedAt: new Date(Date.parse(meetingAt) - MEET_LEAD_MS + 1).toISOString() }, meetingAt), true)
  // No date: any start counts.
  assert.equal(realMeetingRan({ startedAt: ago(1) }, null), true)
})

test('the real Start ends a rehearsal, and wipes it all unless the meeting is already on', () => {
  assert.equal(rehearsalWipeMode(running, meetingAt, now), 'all')
  assert.equal(rehearsalWipeMode({ ...running, startedAt: ago(1000), endedAt: null }, meetingAt, now), 'code')
  assert.equal(rehearsalWipeMode({ ...running, startedAt: meetingAt, endedAt: meetingAt }, meetingAt, Date.parse(meetingAt) + 3_600_000), 'code')
  const route = readFileSync(new URL('../../app/api/admin/meeting/route.ts', import.meta.url), 'utf8')
  const start = route.slice(route.indexOf("case 'start'"), route.indexOf("case 'rehearse_start'"))
  assert.ok(start.indexOf('endRehearsal(') > 0 && start.indexOf('endRehearsal(') < start.indexOf('saveMeeting('), 'start wipes the rehearsal before going live')
  const rehearse = route.slice(route.indexOf("case 'rehearse_start'"), route.indexOf("case 'take_over'"))
  assert.match(rehearse, /rehearsalBlocked\(/)
  assert.doesNotMatch(rehearse, /\b(started_at|ended_at):/, 'a rehearsal never sets started_at or ended_at')
  // End during a rehearsal is the rehearsal's end: no ended_at.
  const end = route.slice(route.indexOf("case 'end'"), route.indexOf("case 'open_activity'"))
  assert.ok(end.indexOf('endRehearsal(') < end.indexOf('ended_at: now'))
})

/** A Supabase-shaped recorder: every call chain, in order. */
function fakeDb(fail: (table: string, op: string, arg: unknown) => { message: string; code?: string } | null = () => null) {
  const calls: { table: string; op: string; arg: unknown; filters: [string, unknown][] }[] = []
  return {
    calls,
    from(table: string) {
      const chain = (op: string, arg: unknown) => {
        const call = { table, op, arg, filters: [] as [string, unknown][] }
        calls.push(call)
        const c = {
          eq(col: string, v: unknown) { call.filters.push([col, v]); return c },
          then(res: (v: { error: unknown }) => unknown) { return Promise.resolve({ error: fail(table, op, arg) }).then(res) },
        }
        return c
      }
      return { update: (patch: unknown) => chain('update', patch), delete: () => chain('delete', null) }
    },
  }
}

test('wipeRehearsal all: code first, then people (answers cascade), activities to ready, presenter and slide cleared', async () => {
  const db = fakeDb()
  assert.equal(await wipeRehearsal(db, 'c1', 'all'), null)
  assert.deepEqual(
    db.calls.map(c => [c.table, c.op, c.arg]),
    [
      ['meetings', 'update', { rehearsal_code: null, rehearsal_started_at: null }],
      ['meeting_participants', 'delete', null],
      ['meeting_questions', 'delete', null],
      ['meeting_activities', 'update', { status: 'ready', opened_at: null, closed_at: null, closes_at: null, hidden_words: [] }],
      ['meetings', 'update', { presenter_id: null, current_segment: null, segment_started_at: null, started_at: null, ended_at: null }],
    ],
  )
  // Every one scoped to this month, nothing wider.
  for (const c of db.calls) assert.deepEqual(c.filters, [['cycle_id', 'c1']])
})

test('wipeRehearsal code: only the code, nothing of the meeting', async () => {
  const db = fakeDb()
  assert.equal(await wipeRehearsal(db, 'c1', 'code'), null)
  assert.deepEqual(db.calls.map(c => [c.table, c.op]), [['meetings', 'update']])
})

test('wipeRehearsal: a missing 047 stops before deleting anything', async () => {
  const db = fakeDb((table, op, arg) => (table === 'meetings' && (arg as Record<string, unknown>)?.rehearsal_code === null ? { message: 'column "rehearsal_code" does not exist' } : null))
  const err = await wipeRehearsal(db, 'c1', 'all')
  assert.match(err?.message ?? '', /rehearsal_code/)
  assert.equal(db.calls.length, 1)
})

test('wipeRehearsal: before 045 still clears started and ended; missing 046 tables are nothing to wipe', async () => {
  const db = fakeDb((table, op, arg) => {
    if (table === 'meeting_participants') return { message: 'relation "meeting_participants" does not exist', code: '42P01' }
    if (table === 'meetings' && (arg as Record<string, unknown>)?.presenter_id === null) return { message: 'column "presenter_id" does not exist' }
    return null
  })
  assert.equal(await wipeRehearsal(db, 'c1', 'all'), null)
  assert.deepEqual(db.calls.at(-1)?.arg, { started_at: null, ended_at: null })
})

test('wipeRehearsal: before 051 the questions table and hidden_words are skipped, not an error', async () => {
  const db = fakeDb((table, op, arg) => {
    if (table === 'meeting_questions') return { message: 'Could not find the table \'public.meeting_questions\' in the schema cache', code: 'PGRST205' }
    if (table === 'meeting_activities' && 'hidden_words' in ((arg as Record<string, unknown>) ?? {})) return { message: 'column "hidden_words" of relation "meeting_activities" does not exist' }
    return null
  })
  assert.equal(await wipeRehearsal(db, 'c1', 'all'), null)
  const acts = db.calls.filter(c => c.table === 'meeting_activities')
  assert.deepEqual(acts.map(c => c.arg), [
    { status: 'ready', opened_at: null, closed_at: null, closes_at: null, hidden_words: [] },
    { status: 'ready', opened_at: null, closed_at: null, closes_at: null },
  ])
})

test('wipeRehearsal: before 048 and 051 both optional columns drop out, one at a time', async () => {
  const db = fakeDb((table, op, arg) => {
    const a = (arg as Record<string, unknown>) ?? {}
    if (table === 'meeting_activities' && 'closes_at' in a) return { message: "Could not find the 'closes_at' column of 'meeting_activities' in the schema cache", code: 'PGRST204' }
    if (table === 'meeting_activities' && 'hidden_words' in a) return { message: "Could not find the 'hidden_words' column of 'meeting_activities' in the schema cache", code: 'PGRST204' }
    return null
  })
  assert.equal(await wipeRehearsal(db, 'c1', 'all'), null)
  const acts = db.calls.filter(c => c.table === 'meeting_activities')
  assert.deepEqual(acts.at(-1)?.arg, { status: 'ready', opened_at: null, closed_at: null })
  assert.equal(acts.length, 3)
})

test('resetActivities: any other error is returned, not retried', async () => {
  const db = fakeDb(table => (table === 'meeting_activities' ? { message: 'permission denied' } : null))
  assert.match((await resetActivities(db, 'c1'))?.message ?? '', /permission/)
  assert.equal(db.calls.length, 1)
})
