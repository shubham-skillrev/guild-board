import 'server-only'
import { createHash, randomBytes } from 'node:crypto'
import { after } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { MEET_EVENT, meetingChannel } from '@/lib/realtime/channels'
import { openCycle } from '@/lib/guild/demos'
import { isBlocked } from '@/lib/meet/profanity'
import {
  aggregate,
  BLOCKED_MESSAGE,
  CLOUD_MAX_WORDS,
  cleanResponse,
  type ActivityRow,
  type MeetView,
  type Mine,
  type RoomState,
} from '@/lib/meet/activity'

/**
 * Meeting mode's room on the server (docs/06-meeting-mode.md, migration 046):
 * who joined, answering, and the live aggregate everyone sees.
 *
 *   joining    members by their session; guests by a typed name and a random
 *              token in an httpOnly cookie (only its SHA-256 is stored).
 *              Only while the meeting is live; the hashes are cleared when it
 *              ends, so the cookie dies with it.
 *   answering  checked against the open activity, filtered for profanity
 *              (word cloud), stored, then the room is "nudged".
 *   the room   RoomState: participant count + the open activity's counts or
 *              words. Pulled by GET /api/meet and GET /api/admin/meeting, and
 *              pushed on `meeting:{cycle_id}` by nudgeRoom(), at most once a
 *              second per meeting however many answers arrive.
 */

type Admin = ReturnType<typeof createAdminClient>

export const MEET_COOKIE = 'gb_meet'
/** A guest's token outlives no meeting: 6 h, and cleared at the end anyway. */
const COOKIE_MAX_AGE = 6 * 3600
/** A meeting nobody ended stops counting as live after this long. */
const LIVE_MAX_MS = 8 * 3_600_000
/** More guests than this in one meeting is someone scripting the join. */
const GUEST_CAP = 150
/** The broadcast throttle's gap (meeting_live_claim). */
const GAP_MS = 1000

export interface MeetingRow {
  started_at: string | null
  ended_at: string | null
  current_segment?: string | null
}

export function isLive(m: MeetingRow | null | undefined, now = Date.now()): boolean {
  return !!m?.started_at && !m.ended_at && now - new Date(m.started_at).getTime() < LIVE_MAX_MS
}

/** Whether an error only means migration 046 isn't applied. */
export function missing046(error: { message?: string; code?: string } | null | undefined): boolean {
  return !!error && (error.code === '42P01' || error.code === 'PGRST205' || error.code === 'PGRST202' || /meeting_(participants|activities|responses)|meeting_live_claim|live_sent_at/.test(error.message ?? ''))
}

/** The meeting /meet is about: the open month's. */
export async function currentMeeting(admin: Admin) {
  const cycle = await openCycle(admin)
  if (!cycle) return null
  const { data } = await admin.from('meetings').select('*').eq('cycle_id', cycle.id).maybeSingle()
  return { cycle, row: (data ?? null) as (MeetingRow & { current_segment?: string | null }) | null }
}

/** The live room, or null before migration 046 (or with no meeting row). */
export async function readRoom(admin: Admin, cycleId: string, row?: MeetingRow | null): Promise<RoomState | null> {
  const meeting = row !== undefined ? row : (await admin.from('meetings').select('*').eq('cycle_id', cycleId).maybeSingle()).data
  if (!meeting) return null
  const [people, acts] = await Promise.all([
    admin.from('meeting_participants').select('id', { count: 'exact', head: true }).eq('cycle_id', cycleId),
    admin.from('meeting_activities').select('*').eq('cycle_id', cycleId),
  ])
  if (people.error || acts.error) {
    if (!missing046(people.error ?? acts.error)) console.warn('readRoom failed', people.error ?? acts.error)
    return null
  }
  const activities = (acts.data ?? []) as ActivityRow[]
  const segment = meeting.current_segment ?? null
  const shown = activities.find(a => a.status === 'open') ?? activities.find(a => a.segment_id === segment) ?? null
  let activity = null
  if (shown) {
    const { data: rows } = await admin.from('meeting_responses').select('participant_id, slot, value').eq('activity_id', shown.id)
    activity = aggregate(shown, rows ?? [])
  }
  return {
    cycleId,
    live: isLive(meeting),
    participants: people.count ?? 0,
    segment,
    activity,
    warm: activities.some(a => !!a.opened_at),
    at: new Date().toISOString(),
  }
}

/** Send the room to everyone listening, now. */
async function publishRoom(admin: Admin, cycleId: string): Promise<void> {
  const room = await readRoom(admin, cycleId)
  if (!room) return
  const channel = admin.channel(meetingChannel(cycleId), { config: { private: true } })
  try {
    const res = await channel.httpSend(MEET_EVENT, room)
    if (!res.success) console.warn(`meeting broadcast failed: ${res.status} ${res.error}`)
  } finally {
    await admin.removeChannel(channel)
  }
}

/**
 * Something in the room changed: broadcast it, at most once a second.
 *
 * Serverless has no shared timer, so the throttle lives in the database:
 * meeting_live_claim() atomically says "send now" (the last send was a gap
 * ago), "you own the trailing flush, wait N ms" (one per gap, so the last
 * answers of a burst still go out within a second), or "nothing to do" (a
 * flush is already waiting and will read your answer too). The aggregate is
 * read after the claim, so a send never carries less than what was stored
 * before it. Runs after the response (after()), never delays the answer.
 * Clients that miss a broadcast pull the same RoomState on their 3 s poll.
 */
export function nudgeRoom(cycleId: string): void {
  after(async () => {
    try {
      const admin = createAdminClient()
      for (let i = 0; i < 3; i++) {
        const { data, error } = await admin.rpc('meeting_live_claim', { p_cycle: cycleId, p_gap_ms: GAP_MS })
        if (error) {
          if (!missing046(error)) console.warn('meeting_live_claim failed', error.message)
          return
        }
        const wait = Number(data)
        if (wait === 0) return await publishRoom(admin, cycleId)
        if (!(wait > 0)) return
        await new Promise(r => setTimeout(r, Math.min(wait, GAP_MS) + 20))
      }
    } catch (err) {
      console.warn('nudgeRoom failed', err)
    }
  })
}

// ─── Who is asking ─────────────────────────────────────────────────────────

export interface Participant {
  id: string
  kind: 'member' | 'guest'
  name: string | null
}

const hash = (token: string) => createHash('sha256').update(token).digest('hex')

/** The signed-in member's id, if any (a local JWT check). */
export async function sessionUserId(): Promise<string | null> {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  return (data?.claims?.sub as string | undefined) ?? null
}

/** This request's participant in the meeting, if they joined. */
export async function findParticipant(admin: Admin, cycleId: string, userId: string | null, guestToken: string | undefined): Promise<Participant | null> {
  if (userId) {
    const { data } = await admin.from('meeting_participants').select('id').eq('cycle_id', cycleId).eq('user_id', userId).maybeSingle()
    return data ? { id: data.id, kind: 'member', name: null } : null
  }
  if (!guestToken || guestToken.length > 100) return null
  const { data } = await admin.from('meeting_participants').select('id, guest_name').eq('cycle_id', cycleId).eq('guest_token_hash', hash(guestToken)).maybeSingle()
  return data ? { id: data.id, kind: 'guest', name: data.guest_name } : null
}

export type JoinResult =
  | { ok: true; participant: Participant; cookie?: { name: string; value: string; maxAge: number } }
  | { ok: false; status: number; error: string }

export async function joinMember(admin: Admin, cycleId: string, userId: string): Promise<JoinResult> {
  const { error } = await admin.from('meeting_participants').upsert({ cycle_id: cycleId, user_id: userId }, { onConflict: 'cycle_id,user_id', ignoreDuplicates: true })
  if (error) return joinFailed(error)
  const p = await findParticipant(admin, cycleId, userId, undefined)
  if (!p) return { ok: false, status: 500, error: 'Could not join. Try again.' }
  nudgeRoom(cycleId)
  return { ok: true, participant: p }
}

/** A guest name: letters and the usual, 1-40 characters. Stored, never shown on screen. */
export function cleanName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const n = raw.normalize('NFKC').replace(/[\p{C}]/gu, '').replace(/\s+/g, ' ').trim()
  return n ? [...n].slice(0, 40).join('').trim() : null
}

export async function joinGuest(admin: Admin, cycleId: string, name: string): Promise<JoinResult> {
  const { count, error: countError } = await admin.from('meeting_participants').select('id', { count: 'exact', head: true }).eq('cycle_id', cycleId).not('guest_name', 'is', null)
  if (countError) return joinFailed(countError)
  if ((count ?? 0) >= GUEST_CAP) return { ok: false, status: 429, error: 'The room is full.' }
  const token = randomBytes(32).toString('base64url')
  const { data, error } = await admin.from('meeting_participants').insert({ cycle_id: cycleId, guest_name: name, guest_token_hash: hash(token) }).select('id').single()
  if (error || !data) return joinFailed(error)
  nudgeRoom(cycleId)
  return { ok: true, participant: { id: data.id, kind: 'guest', name }, cookie: { name: MEET_COOKIE, value: token, maxAge: COOKIE_MAX_AGE } }
}

function joinFailed(error: { message?: string; code?: string } | null): JoinResult {
  if (missing046(error)) return { ok: false, status: 503, error: 'The meeting room isn’t set up yet (migration 046).' }
  console.warn('meeting join failed', error)
  return { ok: false, status: 500, error: 'Could not join. Try again.' }
}

// ─── Answering ─────────────────────────────────────────────────────────────

export async function mineFor(admin: Admin, participantId: string, activityId: string): Promise<Mine> {
  const { data } = await admin.from('meeting_responses').select('slot, value').eq('activity_id', activityId).eq('participant_id', participantId).order('slot')
  return { activityId, values: (data ?? []).map(r => r.value as Record<string, unknown>) }
}

export type RespondResult =
  | { ok: true; mine: Mine }
  | { ok: false; blocked: true; message: string; mine: Mine }
  | { ok: false; blocked?: false; status: number; error: string }

export async function respond(admin: Admin, cycleId: string, participant: Participant, activityId: unknown, raw: unknown): Promise<RespondResult> {
  if (typeof activityId !== 'string' || !/^[0-9a-f-]{36}$/i.test(activityId)) return { ok: false, status: 400, error: 'No such activity' }
  const { data: activity } = await admin.from('meeting_activities').select('*').eq('id', activityId).eq('cycle_id', cycleId).maybeSingle()
  if (!activity) return { ok: false, status: 404, error: 'No such activity' }
  if (activity.status !== 'open') return { ok: false, status: 409, error: 'That one has closed. Watch the screen.' }
  const cleaned = cleanResponse(activity as ActivityRow, raw)
  if (!cleaned.ok) return { ok: false, status: 400, error: cleaned.error }

  switch ((activity as ActivityRow).kind) {
    case 'poll': {
      const { error } = await admin
        .from('meeting_responses')
        .upsert({ activity_id: activityId, participant_id: participant.id, slot: 0, value: cleaned.value, updated_at: new Date().toISOString() }, { onConflict: 'activity_id,participant_id,slot' })
      if (error) return { ok: false, status: 500, error: 'Could not save that. Try again.' }
      break
    }
    case 'cloud': {
      const word = String(cleaned.value.word)
      // Checked as typed too: cleaning drops "$", "!" and "*", which leetspeak uses.
      const typed = (raw as { word?: unknown } | null)?.word
      // Dropped quietly: nothing stored, nothing broadcast.
      if (isBlocked(word) || (typeof typed === 'string' && isBlocked(typed.slice(0, 100)))) return { ok: false, blocked: true, message: BLOCKED_MESSAGE, mine: await mineFor(admin, participant.id, activityId) }
      // Two tries: a second phone tab may take the same free slot at once.
      for (let attempt = 0; attempt < 2; attempt++) {
        const { data: rows } = await admin.from('meeting_responses').select('slot, value').eq('activity_id', activityId).eq('participant_id', participant.id)
        const had = rows ?? []
        if (had.some(r => (r.value as { word?: unknown })?.word === word)) return { ok: true, mine: await mineFor(admin, participant.id, activityId) }
        const used = new Set(had.map(r => r.slot))
        const slot = [0, 1, 2].slice(0, CLOUD_MAX_WORDS).find(s => !used.has(s))
        if (slot === undefined) return { ok: false, status: 409, error: 'That’s your three.' }
        const { error } = await admin.from('meeting_responses').insert({ activity_id: activityId, participant_id: participant.id, slot, value: cleaned.value })
        if (!error) break
        if (error.code !== '23505' || attempt === 1) return { ok: false, status: 500, error: 'Could not save that. Try again.' }
      }
      break
    }
    case 'boss':
      return { ok: false, status: 400, error: 'The Boss Round isn’t ready yet.' }
  }

  nudgeRoom(cycleId)
  return { ok: true, mine: await mineFor(admin, participant.id, activityId) }
}

// ─── The phone's view ──────────────────────────────────────────────────────

/** Everything /meet shows this person: GET /api/meet and the page's first render. */
export async function meetView(admin: Admin, userId: string | null, guestToken: string | undefined): Promise<MeetView> {
  const empty: MeetView = { cycleId: null, label: null, ready: true, room: null, member: null, joined: null, mine: null }
  const [m, profile] = await Promise.all([
    currentMeeting(admin),
    userId ? admin.from('users').select('username').eq('id', userId).maybeSingle() : null,
  ])
  const member = userId ? profile?.data?.username ?? 'you' : null
  if (!m) return { ...empty, member }
  const view: MeetView = { ...empty, cycleId: m.cycle.id, label: m.cycle.label, member }
  if (!m.row) return view
  const room = await readRoom(admin, m.cycle.id, m.row)
  if (!room) return { ...view, ready: false, room: { cycleId: m.cycle.id, live: isLive(m.row), participants: 0, segment: null, activity: null, warm: false, at: new Date().toISOString() } }
  view.room = room
  const p = room.live ? await findParticipant(admin, m.cycle.id, userId, guestToken) : null
  if (p) {
    view.joined = { kind: p.kind, name: p.name }
    if (room.activity?.status === 'open') view.mine = await mineFor(admin, p.id, room.activity.id)
  }
  return view
}

/** Meeting over: close what's open and expire every guest's token. */
export async function closeRoom(admin: Admin, cycleId: string): Promise<void> {
  const now = new Date().toISOString()
  await admin.from('meeting_activities').update({ status: 'closed', closed_at: now }).eq('cycle_id', cycleId).eq('status', 'open')
  await admin.from('meeting_participants').update({ guest_token_hash: null }).eq('cycle_id', cycleId).not('guest_token_hash', 'is', null)
  nudgeRoom(cycleId)
}

/** The presenter moved on: whatever was open closes. */
export async function closeOpenActivities(admin: Admin, cycleId: string): Promise<void> {
  await admin.from('meeting_activities').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('cycle_id', cycleId).eq('status', 'open')
}

/** Open one activity (closing any other): the presenter's one button. */
export async function openActivity(admin: Admin, cycleId: string, activityId: unknown): Promise<{ error: string | null; status?: number }> {
  if (typeof activityId !== 'string') return { error: 'No such activity', status: 400 }
  const { data: a, error } = await admin.from('meeting_activities').select('id, status').eq('id', activityId).eq('cycle_id', cycleId).maybeSingle()
  if (error) return { error: missing046(error) ? 'Apply migration 046 first.' : error.message, status: 500 }
  if (!a) return { error: 'No such activity', status: 404 }
  if (a.status !== 'open') {
    await admin.from('meeting_activities').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('cycle_id', cycleId).eq('status', 'open')
    const { error: e } = await admin.from('meeting_activities').update({ status: 'open', opened_at: new Date().toISOString(), closed_at: null }).eq('id', activityId)
    if (e) return { error: e.message, status: 500 }
  }
  nudgeRoom(cycleId)
  return { error: null }
}

export async function closeActivity(admin: Admin, cycleId: string, activityId: unknown): Promise<void> {
  if (typeof activityId !== 'string') return
  await admin.from('meeting_activities').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', activityId).eq('cycle_id', cycleId).eq('status', 'open')
  nudgeRoom(cycleId)
}
