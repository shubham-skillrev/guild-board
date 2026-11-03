import 'server-only'
import { randomInt } from 'node:crypto'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { SURVEY_KEY } from '@/lib/survey'
import { PASSES_PER_YEAR, type DemoKind } from '@/lib/showtell'
import { sendPushToUser } from '@/lib/push/send'

/**
 * Kers' draw for Show & Tell (migration 042).
 *
 * The morning a month opens, Kers draws two names per open slot: the first
 * is invited, the second waits quietly as a reserve. Admins get a day to
 * swap anyone before invitations go out. A pass, or three days without an
 * answer, moves the reserve up; a slot that runs out gets one redraw, then
 * becomes an admin's to-do. Nobody but admins ever learns who was drawn or
 * who passed: the guild only hears about people who said yes.
 *
 * The draw is weighted towards the willing: 3 tickets for anyone who
 * volunteered or was nominated in the survey, 2 for anyone who said they
 * could show something, 1 for everyone else. Out of the draw: anyone who
 * presented in the last three months, anyone out of passes this year, and
 * anyone already lined up this month.
 */

const PICKS = 2
const REVIEW_MS = 24 * 3_600_000
const ANSWER_MS = 3 * 86_400_000
const COOLDOWN_MS = 90 * 86_400_000

export interface Candidate {
  userId: string
  tickets: number
}

function norm(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase()
}

/** Everyone who may be drawn this month, with their tickets. */
export async function drawPool(admin: SupabaseClient, cycleId: string, exclude: Set<string>): Promise<Candidate[]> {
  const year = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).slice(0, 4)
  const since = new Date(Date.now() - COOLDOWN_MS).toISOString()
  const [{ data: users }, { data: passed }, { data: presented }, { data: lined }, { data: offers }, { data: survey }] = await Promise.all([
    admin.from('users').select('id, username, real_name, email').eq('is_system', false),
    admin.from('demos').select('user_id').eq('status', 'passed').gte('responded_at', `${year}-01-01T00:00:00+05:30`),
    admin.from('demos').select('user_id').in('status', ['confirmed', 'done']).gte('updated_at', since),
    admin.from('demos').select('user_id').eq('cycle_id', cycleId).in('status', ['invited', 'confirmed']),
    admin.from('demos').select('user_id').eq('kind', 'demo').eq('status', 'proposed'),
    admin.from('survey_responses').select('email, demo, nominee_name').eq('survey', SURVEY_KEY),
  ])

  const passes = new Map<string, number>()
  for (const p of passed ?? []) passes.set(p.user_id, (passes.get(p.user_id) ?? 0) + 1)
  const out = new Set([...(presented ?? []), ...(lined ?? [])].map(d => d.user_id))
  const volunteered = new Set((offers ?? []).map(d => d.user_id))
  const canShow = new Set((survey ?? []).filter(s => s.demo === 'yes' || s.demo === 'maybe').map(s => s.email))

  // Survey nominations are free text: match a full name or handle, or a first
  // name that belongs to exactly one member.
  const people = users ?? []
  const firsts = new Map<string, number>()
  for (const u of people) { const f = norm(u.real_name).split(/\s+/)[0]; if (f) firsts.set(f, (firsts.get(f) ?? 0) + 1) }
  const nominated = new Set<string>()
  for (const s of survey ?? []) {
    const n = norm(s.nominee_name).replace(/^@/, '')
    if (!n) continue
    const hit = people.find(u =>
      norm(u.real_name) === n || norm(u.username) === n ||
      (firsts.get(n.split(/\s+/)[0]) === 1 && norm(u.real_name).split(/\s+/)[0] === n.split(/\s+/)[0]),
    )
    if (hit) nominated.add(hit.id)
  }

  return people
    .filter(u => !exclude.has(u.id) && !out.has(u.id) && (passes.get(u.id) ?? 0) < PASSES_PER_YEAR)
    .map(u => ({
      userId: u.id,
      tickets: volunteered.has(u.id) || nominated.has(u.id) ? 3 : canShow.has(norm(u.email)) ? 2 : 1,
    }))
}

/** Weighted draw without replacement. */
export function sample(pool: Candidate[], n: number): Candidate[] {
  const left = [...pool]
  const picked: Candidate[] = []
  while (picked.length < n && left.length) {
    const total = left.reduce((s, c) => s + c.tickets, 0)
    let ticket = randomInt(total)
    const i = left.findIndex(c => (ticket -= c.tickets) < 0)
    picked.push(...left.splice(i, 1))
  }
  return picked
}

async function picksOf(admin: SupabaseClient, cycleId: string): Promise<Set<string>> {
  const { data } = await admin.from('draw_picks').select('user_id, draws!inner(cycle_id)').eq('draws.cycle_id', cycleId)
  return new Set((data ?? []).map(p => p.user_id))
}

/** Draw for one slot. Round 1 waits for admin review; round 2 invites straight away. */
async function createDraw(admin: SupabaseClient, cycleId: string, kind: DemoKind, round: 1 | 2): Promise<string | null> {
  const picks = sample(await drawPool(admin, cycleId, await picksOf(admin, cycleId)), PICKS)
  if (!picks.length) return null
  const { data: draw, error } = await admin
    .from('draws')
    .insert({ cycle_id: cycleId, kind, round, status: round === 1 ? 'review' : 'inviting', review_until: round === 1 ? new Date(Date.now() + REVIEW_MS).toISOString() : null })
    .select('id')
    .single()
  if (error || !draw) return null
  await admin.from('draw_picks').insert(picks.map((p, i) => ({ draw_id: draw.id, user_id: p.userId, tickets: p.tickets, position: i + 1, state: 'waiting' })))
  if (round === 2) await inviteNext(admin, draw.id)
  return draw.id
}

/**
 * The month's draw: the Spotlight always (unless someone is already lined
 * up), the Demo only when no volunteer is booked or offered for this month.
 * Safe to call again: a slot with a draw is left alone.
 */
export async function runMonthlyDraw(cycleId: string): Promise<string[]> {
  const admin = createAdminClient()
  const [{ data: draws }, { data: demos }] = await Promise.all([
    admin.from('draws').select('kind').eq('cycle_id', cycleId),
    admin.from('demos').select('kind, status').eq('cycle_id', cycleId).in('status', ['proposed', 'invited', 'confirmed']),
  ])
  const drawn = new Set((draws ?? []).map(d => d.kind))
  const taken = (kind: DemoKind) => (demos ?? []).some(d => d.kind === kind)
  const made: string[] = []
  for (const kind of ['spotlight', 'demo'] as const) {
    if (drawn.has(kind) || taken(kind)) continue
    if (await createDraw(admin, cycleId, kind, 1)) made.push(kind)
  }
  return made
}

/** Invite the next reserve, or redraw once, or give the slot to an admin. */
export async function inviteNext(admin: SupabaseClient, drawId: string): Promise<void> {
  const { data: draw } = await admin.from('draws').select('id, cycle_id, kind, round, status').eq('id', drawId).maybeSingle()
  if (!draw || draw.status === 'filled' || draw.status === 'cancelled' || draw.status === 'failed') return

  const { data: next } = await admin
    .from('draw_picks')
    .select('id, user_id')
    .eq('draw_id', drawId)
    .eq('state', 'waiting')
    .order('position')
    .limit(1)
    .maybeSingle()

  if (!next) {
    if (draw.round === 1) {
      await admin.from('draws').update({ status: 'failed' }).eq('id', drawId)
      await createDraw(admin, draw.cycle_id, draw.kind, 2)
    } else {
      await admin.from('draws').update({ status: 'failed' }).eq('id', drawId)
    }
    return
  }

  const { data: demo } = await admin
    .from('demos')
    .insert({
      user_id: next.user_id,
      kind: draw.kind,
      status: 'invited',
      format: 'demo',
      cycle_id: draw.cycle_id,
      note: 'Kers drew your name from the guild hat.',
    })
    .select('id')
    .single()
  const now = new Date().toISOString()
  await Promise.all([
    admin.from('draw_picks').update({ state: 'invited', demo_id: demo?.id ?? null, invited_at: now }).eq('id', next.id),
    admin.from('draws').update({ status: 'inviting' }).eq('id', drawId),
  ])
  await sendPushToUser(next.user_id, {
    title: draw.kind === 'spotlight' ? 'Kers drew your name for the Spotlight' : 'Kers drew your name for a demo',
    body: 'Ten minutes at this month’s guild meeting, any format. Say yes or pass on your board, no hard feelings.',
    url: '/board',
    tag: 'kers-draw',
  }).catch(() => {})
}

/** A drawn invitation was answered: fill the slot, or move the reserve up. */
export async function onDrawAnswer(demoId: string, accepted: boolean): Promise<void> {
  const admin = createAdminClient()
  const { data: pick } = await admin.from('draw_picks').select('id, draw_id').eq('demo_id', demoId).maybeSingle()
  if (!pick) return
  await admin.from('draw_picks').update({ state: accepted ? 'accepted' : 'passed' }).eq('id', pick.id)
  if (accepted) await admin.from('draws').update({ status: 'filled' }).eq('id', pick.draw_id)
  else await inviteNext(admin, pick.draw_id)
}

/**
 * The daily cron's part: send invitations once the review day is over, and
 * move past anyone who hasn't answered in three days (their invitation just
 * quietly goes away).
 */
export async function tickDraws(): Promise<{ invited: number; expired: number }> {
  const admin = createAdminClient()
  const now = Date.now()
  let invited = 0
  let expired = 0

  const { data: reviewed } = await admin.from('draws').select('id').eq('status', 'review').lte('review_until', new Date(now).toISOString())
  for (const d of reviewed ?? []) { await inviteNext(admin, d.id); invited += 1 }

  const { data: stale } = await admin
    .from('draw_picks')
    .select('id, draw_id, demo_id, draws!inner(status)')
    .eq('state', 'invited')
    .eq('draws.status', 'inviting')
    .lte('invited_at', new Date(now - ANSWER_MS).toISOString())
  for (const p of stale ?? []) {
    if (p.demo_id) {
      const { data: demo } = await admin.from('demos').select('status').eq('id', p.demo_id).maybeSingle()
      if (demo?.status !== 'invited') continue
      await admin.from('demos').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', p.demo_id)
    }
    await admin.from('draw_picks').update({ state: 'expired' }).eq('id', p.id)
    await inviteNext(admin, p.draw_id)
    expired += 1
  }
  return { invited, expired }
}

/** During review: put someone else in a pick's place (a given member, or a fresh random one). */
export async function swapPick(pickId: string, userId?: string): Promise<{ error?: string }> {
  const admin = createAdminClient()
  const { data: pick } = await admin.from('draw_picks').select('id, draw_id, draws!inner(cycle_id, status)').eq('id', pickId).maybeSingle()
  const draw = pick?.draws as unknown as { cycle_id: string; status: string } | undefined
  if (!pick || !draw) return { error: 'No such pick' }
  if (draw.status !== 'review') return { error: 'Invitations have gone out; it can’t be swapped now.' }

  const pool = await drawPool(admin, draw.cycle_id, await picksOf(admin, draw.cycle_id))
  const chosen = userId ? pool.find(c => c.userId === userId) : sample(pool, 1)[0]
  if (!chosen) return { error: userId ? 'They can’t be drawn this month (presented recently, out of passes, or already lined up).' : 'Nobody left to draw.' }
  await admin.from('draw_picks').update({ user_id: chosen.userId, tickets: chosen.tickets }).eq('id', pickId)
  return {}
}

/** Skip the rest of the review day and send the invitations now. */
export async function sendDrawNow(drawId: string): Promise<void> {
  const admin = createAdminClient()
  const { data: draw } = await admin.from('draws').select('status').eq('id', drawId).maybeSingle()
  if (draw?.status === 'review') await inviteNext(admin, drawId)
}

/** An admin invited someone directly: the draw for that slot stands down. */
export async function cancelDraws(admin: SupabaseClient, cycleId: string, kind: DemoKind): Promise<void> {
  const { data: draws } = await admin.from('draws').select('id').eq('cycle_id', cycleId).eq('kind', kind).in('status', ['review', 'inviting'])
  for (const d of draws ?? []) {
    const { data: live } = await admin.from('draw_picks').select('id, demo_id').eq('draw_id', d.id).eq('state', 'invited')
    for (const p of live ?? []) {
      if (p.demo_id) await admin.from('demos').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', p.demo_id).eq('status', 'invited')
      await admin.from('draw_picks').update({ state: 'expired' }).eq('id', p.id)
    }
    await admin.from('draws').update({ status: 'cancelled' }).eq('id', d.id)
  }
}
