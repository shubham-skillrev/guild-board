#!/usr/bin/env node
/**
 * Meeting mode stress test (docs/06-meeting-mode.md, Phase 2): gates the first
 * real meeting. Run it against a PREVIEW deploy and the database that preview
 * uses, never production.
 *
 *   node --env-file=.env.preview scripts/meet-stress.mjs --base https://<preview>.vercel.app [--n 60] [--start] [--keep]
 *
 * Env (the preview's project):
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY   set up and check the run
 *   NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY                  listen on meeting:{id} like a phone
 *   VERCEL_AUTOMATION_BYPASS_SECRET                       optional, for protected previews
 *
 * What it does:
 *   1. Needs the open month's meeting live (--start turns it on, and back off after).
 *   2. Adds two throwaway activities (segments stress-poll, stress-cloud).
 *   3. N guests join through POST /api/meet, each with its own cookie.
 *   4. Poll: all N vote within 5 s; a quarter change their vote once.
 *   5. Word cloud: all N send 3 words within 5 s (overlapping words, so they
 *      merge); 5 also try a blocked word first and one re-sends a duplicate.
 *   6. Removes everything it added (unless --keep).
 *
 * Pass:
 *   - no API errors (every request 2xx; a blocked word answers 200 { blocked })
 *   - the broadcast (what the presenter screen listens to) matches the
 *     expected aggregate within 2 s of the last answer
 *   - the database has exactly one vote per guest and three words per guest,
 *     matching what was sent: nothing lost, nothing doubled
 *   - broadcasts stay at about one a second (never one per answer)
 */
import { createClient } from '@supabase/supabase-js'

const args = process.argv.slice(2)
const arg = (name, fallback = null) => (args.includes(name) ? args[args.indexOf(name) + 1] : fallback)
const BASE = (arg('--base') ?? '').replace(/\/$/, '')
const N = Number(arg('--n', '60'))
const START = args.includes('--start')
const KEEP = args.includes('--keep')
const CATCH_UP_MS = 2000
const WINDOW_MS = 5000

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
const bypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET

if (!BASE || !url || !serviceKey) {
  console.error('Usage: node --env-file=.env.preview scripts/meet-stress.mjs --base https://<preview> [--n 60] [--start] [--keep]')
  console.error('Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY for the preview’s database.')
  process.exit(1)
}
if (/guildboard\.skillrev\.in/.test(BASE) && !args.includes('--yes-prod')) {
  console.error('That looks like production. Point --base at a preview deploy.')
  process.exit(1)
}

const db = createClient(url, serviceKey, { auth: { persistSession: false } })
const sleep = ms => new Promise(r => setTimeout(r, ms))
const rand = n => Math.floor(Math.random() * n)

// ─── HTTP as a phone ───────────────────────────────────────────────────────

const errors = []
const latencies = []

async function api(method, path, { cookie, body } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (cookie) headers.Cookie = cookie
  if (bypass) headers['x-vercel-protection-bypass'] = bypass
  const t0 = performance.now()
  let res
  try {
    res = await fetch(BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined, redirect: 'manual' })
  } catch (err) {
    errors.push(`${method} ${path}: ${err.message}`)
    return { ok: false, status: 0, data: null, res: null }
  }
  latencies.push(performance.now() - t0)
  const data = await res.json().catch(() => null)
  if (!res.ok) errors.push(`${method} ${path} ${res.status}: ${data?.error ?? res.statusText}`)
  return { ok: res.ok, status: res.status, data, res }
}

// ─── Listening like the presenter screen ───────────────────────────────────

const broadcasts = []
function listen(cycleId) {
  if (!anonKey) {
    console.warn('! No NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: checking catch-up by polling GET /api/meet instead of the channel.')
    return async () => {}
  }
  const client = createClient(url, anonKey, { auth: { persistSession: false } })
  const channel = client.channel(`meeting:${cycleId}`, { config: { private: true } })
  channel.on('broadcast', { event: 'room' }, ({ payload }) => broadcasts.push({ t: performance.now(), room: payload }))
  return new Promise(resolve => {
    client.realtime.setAuth().then(() =>
      channel.subscribe(status => {
        if (status === 'SUBSCRIBED') resolve(async () => client.removeChannel(channel))
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.warn(`! Channel ${status}: is migration 046 applied? Falling back to polling.`)
          resolve(async () => client.removeChannel(channel))
        }
      }),
    )
  })
}

/** Wait until the room shows `check` true; returns ms after `since`, or null on timeout. */
async function caughtUp(check, since, timeoutMs = 10_000) {
  const end = since + timeoutMs
  let viaPoll = null
  while (performance.now() < end) {
    const hit = broadcasts.find(b => b.t >= since - 1500 && check(b.room))
    if (hit) return { ms: Math.max(0, hit.t - since), via: 'broadcast' }
    if (viaPoll === null) {
      const r = await api('GET', '/api/meet')
      if (r.data?.room && check(r.data.room)) viaPoll = performance.now() - since
    }
    if (viaPoll !== null && !anonKey) return { ms: viaPoll, via: 'poll' }
    await sleep(100)
  }
  return viaPoll !== null ? { ms: viaPoll, via: 'poll' } : null
}

function maxPerSecond(fromT) {
  const ts = broadcasts.filter(b => b.t >= fromT).map(b => b.t)
  let best = 0
  for (let i = 0; i < ts.length; i++) {
    let j = i
    while (j < ts.length && ts[j] - ts[i] < 1000) j++
    best = Math.max(best, j - i)
  }
  return best
}

// ─── The run ───────────────────────────────────────────────────────────────

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? '  ok  ' : '  FAIL'} ${name}${detail ? ` (${detail})` : ''}`)
}

async function main() {
  console.log(`Meeting stress test: ${N} guests against ${BASE}`)
  const first = await api('GET', '/api/meet')
  const cycleId = first.data?.cycleId
  if (!cycleId) throw new Error('No open month on that deploy.')
  if (first.data.ready === false) throw new Error('Migration 046 isn’t applied on that database.')

  const { data: before } = await db.from('meetings').select('started_at, ended_at').eq('cycle_id', cycleId).maybeSingle()
  if (!before) throw new Error('No meeting row for the open month: save an agenda first.')
  let restore = null
  if (!first.data.room?.live) {
    if (!START) throw new Error('The meeting isn’t live. Start meeting mode, or pass --start.')
    restore = before
    await db.from('meetings').update({ started_at: new Date().toISOString(), ended_at: null }).eq('cycle_id', cycleId)
  }

  const stop = await listen(cycleId)
  await db.from('meeting_activities').delete().eq('cycle_id', cycleId).in('segment_id', ['stress-poll', 'stress-cloud'])
  const options = ['Alpha', 'Bravo', 'Charlie', 'Delta']
  const { data: acts, error } = await db
    .from('meeting_activities')
    .insert([
      { cycle_id: cycleId, segment_id: 'stress-poll', kind: 'poll', prompt: '[stress] Pick one', options },
      { cycle_id: cycleId, segment_id: 'stress-cloud', kind: 'cloud', prompt: '[stress] Three words' },
    ])
    .select('id, kind')
  if (error) throw error
  const poll = acts.find(a => a.kind === 'poll').id
  const cloud = acts.find(a => a.kind === 'cloud').id
  const open = async id => {
    const now = new Date().toISOString()
    await db.from('meeting_activities').update({ status: 'closed', closed_at: now }).eq('cycle_id', cycleId).eq('status', 'open')
    await db.from('meeting_activities').update({ status: 'open', opened_at: now, closed_at: null }).eq('id', id)
  }

  try {
    // Join
    const t0 = performance.now()
    const guests = await Promise.all(
      Array.from({ length: N }, async (_, i) => {
        const r = await api('POST', '/api/meet', { body: { action: 'join', name: `stress-${String(i + 1).padStart(2, '0')}` } })
        const set = r.res?.headers.getSetCookie?.() ?? []
        const cookie = set.map(c => c.split(';')[0]).find(c => c.startsWith('gb_meet='))
        return { i, cookie, joined: !!r.data?.joined }
      }),
    )
    const joined = guests.filter(g => g.cookie && g.joined)
    check(`${N} guests joined`, joined.length === N, `${joined.length} in ${Math.round(performance.now() - t0)} ms`)

    // Poll
    await open(poll)
    const final = new Map()
    const pollStart = performance.now()
    await Promise.all(
      joined.map(async g => {
        await sleep(rand(WINDOW_MS - 1500))
        let choice = rand(options.length)
        const r = await api('POST', '/api/meet', { cookie: g.cookie, body: { action: 'respond', activity_id: poll, value: { option: choice } } })
        if (r.ok) final.set(g.i, choice)
        if (g.i % 4 === 0) {
          await sleep(rand(1000))
          choice = (choice + 1) % options.length
          const r2 = await api('POST', '/api/meet', { cookie: g.cookie, body: { action: 'respond', activity_id: poll, value: { option: choice } } })
          if (r2.ok) final.set(g.i, choice)
        }
      }),
    )
    const pollEnd = performance.now()
    check('all votes sent within 5 s', pollEnd - pollStart <= WINDOW_MS + 500, `${Math.round(pollEnd - pollStart)} ms`)
    const expected = options.map((_, o) => [...final.values()].filter(c => c === o).length)
    const pollCatch = await caughtUp(
      room => room.activity?.id === poll && room.activity.total === final.size && JSON.stringify(room.activity.counts) === JSON.stringify(expected),
      pollEnd,
    )
    check('presenter caught up on the poll within 2 s', !!pollCatch && pollCatch.ms <= CATCH_UP_MS, pollCatch ? `${Math.round(pollCatch.ms)} ms via ${pollCatch.via}` : 'never')
    const { data: votes } = await db.from('meeting_responses').select('participant_id, slot, value').eq('activity_id', poll)
    const voters = new Set(votes.map(v => v.participant_id))
    const dbCounts = options.map((_, o) => votes.filter(v => v.value.option === o).length)
    check('one vote per guest in the database', votes.length === N && voters.size === N, `${votes.length} rows, ${voters.size} voters`)
    check('database counts match what was sent', JSON.stringify(dbCounts) === JSON.stringify(expected), `${dbCounts} vs ${expected}`)

    // Word cloud
    await open(cloud)
    const vocab = ['tired', 'busy', 'shipping', 'flaky', 'calm', 'meetings', 'oncall', 'learning', 'chaos', 'deploys', 'coffee', 'review', 'focus', 'blocked', 'happy', 'release']
    const sent = new Map()
    let blockedOk = 0
    const cloudStart = performance.now()
    await Promise.all(
      joined.map(async g => {
        const mine = new Set()
        while (mine.size < 3) mine.add(vocab[rand(vocab.length)])
        const words = [...mine]
        if (g.i < 5) {
          const r = await api('POST', '/api/meet', { cookie: g.cookie, body: { action: 'respond', activity_id: cloud, value: { word: 'sh1t' } } })
          if (r.ok && r.data?.blocked) blockedOk++
        }
        for (const w of words) {
          await sleep(rand(1200))
          const r = await api('POST', '/api/meet', { cookie: g.cookie, body: { action: 'respond', activity_id: cloud, value: { word: w.toUpperCase() } } })
          if (r.ok) sent.set(`${g.i}:${w}`, w)
        }
        if (g.i === 5) await api('POST', '/api/meet', { cookie: g.cookie, body: { action: 'respond', activity_id: cloud, value: { word: words[0] } } })
      }),
    )
    const cloudEnd = performance.now()
    check('all words sent within 5 s', cloudEnd - cloudStart <= WINDOW_MS + 500, `${Math.round(cloudEnd - cloudStart)} ms`)
    check('blocked words answered quietly', blockedOk === Math.min(5, joined.length), `${blockedOk} of ${Math.min(5, joined.length)}`)
    const merged = {}
    for (const w of sent.values()) merged[w] = (merged[w] ?? 0) + 1
    const cloudCatch = await caughtUp(
      room =>
        room.activity?.id === cloud &&
        room.activity.total === sent.size &&
        (room.activity.words ?? []).every(w => merged[w.word] === w.n) &&
        (room.activity.words ?? []).length === Object.keys(merged).length,
      cloudEnd,
    )
    check('presenter caught up on the word cloud within 2 s', !!cloudCatch && cloudCatch.ms <= CATCH_UP_MS, cloudCatch ? `${Math.round(cloudCatch.ms)} ms via ${cloudCatch.via}` : 'never')
    const { data: words } = await db.from('meeting_responses').select('participant_id, value').eq('activity_id', cloud)
    const per = new Map()
    for (const w of words) per.set(w.participant_id, (per.get(w.participant_id) ?? 0) + 1)
    check('three words per guest in the database, none blocked', words.length === 3 * N && [...per.values()].every(n => n === 3) && !words.some(w => w.value.word === 'sh1t' || w.value.word === 'shit'), `${words.length} rows`)

    // Fan-out
    if (anonKey) {
      const peak = maxPerSecond(pollStart)
      check('broadcasts throttled to about one a second', peak <= 2, `${broadcasts.length} broadcasts, at most ${peak} in any second`)
    }
    check('no API errors', errors.length === 0, errors.length ? `${errors.length}: ${errors.slice(0, 5).join(' | ')}` : `${latencies.length} requests`)
    const sorted = [...latencies].sort((a, b) => a - b)
    console.log(`  latency p50 ${Math.round(sorted[Math.floor(sorted.length * 0.5)])} ms, p95 ${Math.round(sorted[Math.floor(sorted.length * 0.95)])} ms, max ${Math.round(sorted.at(-1))} ms`)
  } finally {
    await stop()
    if (!KEEP) {
      await db.from('meeting_activities').delete().in('id', [poll, cloud])
      await db.from('meeting_participants').delete().eq('cycle_id', cycleId).like('guest_name', 'stress-%')
      if (restore) await db.from('meetings').update(restore).eq('cycle_id', cycleId)
      console.log('  cleaned up')
    }
  }

  const failed = results.filter(r => !r.pass)
  console.log(failed.length ? `\nFAILED: ${failed.length} of ${results.length} checks` : `\nPASSED: all ${results.length} checks`)
  process.exit(failed.length ? 1 : 0)
}

main().catch(err => {
  console.error(err.message ?? err)
  process.exit(1)
})
