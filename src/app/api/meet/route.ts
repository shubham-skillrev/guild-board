// ROUTE: GET  /api/meet  -> MeetView (lib/meet/activity.ts): the room and this person's place in it
//        POST /api/meet  { action: 'join', name? }                 members by session; guests by name
//                        { action: 'respond', activity_id, value } poll { option } / cloud { word }
// AUTH: public (src/proxy.ts). Members are recognised by their session, guests
//       by the httpOnly `gb_meet` cookie set on join (its SHA-256 is stored).
//       Joining and answering only while the meeting is live, or during a
//       live rehearsal with its code (the `gb_meet_r` cookie the proxy sets
//       from /meet?r=<code>; lib/meet/liveRehearsal.ts).
// PURPOSE: Meeting mode's audience (docs/06-meeting-mode.md, Phase 2). Answers
//          are aggregated server-side and broadcast on `meeting:{cycle_id}` at
//          most once a second (lib/meet/room.ts).
// DB TABLES: meetings, meeting_participants, meeting_activities, meeting_responses

import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { cleanName, currentMeeting, findParticipant, joinGuest, joinMember, loadActivity, MEET_COOKIE, meetView, respond, roomOpenTo, sessionUserId } from '@/lib/meet/room'
import { REHEARSAL_COOKIE } from '@/lib/meet/liveRehearsal'

const NO_STORE = { 'Cache-Control': 'no-store' }

export async function GET() {
  const [userId, store] = await Promise.all([sessionUserId(), cookies()])
  const view = await meetView(createAdminClient(), userId, store.get(MEET_COOKIE)?.value, store.get(REHEARSAL_COOKIE)?.value)
  return NextResponse.json(view, { headers: NO_STORE })
}

export async function POST(request: Request) {
  // JSON only: a cross-site form can't send it without a CORS preflight, so
  // the lax cookies can't be ridden from another site.
  if (!request.headers.get('content-type')?.includes('application/json')) return NextResponse.json({ error: 'Send JSON' }, { status: 415 })
  let body: Record<string, unknown> = {}
  try { body = await request.json() } catch { /* empty body */ }

  const admin = createAdminClient()
  const [userId, store, m] = await Promise.all([sessionUserId(), cookies(), currentMeeting(admin)])
  const code = store.get(REHEARSAL_COOKIE)?.value
  // Same answer for a rehearsal without its code: nothing gives it away.
  if (!m?.row || !roomOpenTo(m.row, code)) return NextResponse.json({ error: 'There’s no meeting on right now.' }, { status: 409 })
  const cycleId = m.cycle.id
  const token = store.get(MEET_COOKIE)?.value

  switch (body.action) {
    case 'join': {
      const existing = await findParticipant(admin, cycleId, userId, token)
      if (!existing) {
        let r
        if (userId) r = await joinMember(admin, cycleId, userId)
        else {
          const name = cleanName(body.name)
          if (!name) return NextResponse.json({ error: 'Type your name first.' }, { status: 400 })
          r = await joinGuest(admin, cycleId, name)
        }
        if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
        if (r.cookie) {
          store.set(r.cookie.name, r.cookie.value, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: r.cookie.maxAge })
        }
        return NextResponse.json(await meetView(admin, userId, r.cookie?.value ?? token, code), { headers: NO_STORE })
      }
      return NextResponse.json(await meetView(admin, userId, token, code), { headers: NO_STORE })
    }
    case 'respond': {
      // Who's answering and what to, at once: every round trip here is felt on the phone.
      const [p, activity] = await Promise.all([findParticipant(admin, cycleId, userId, token), loadActivity(admin, cycleId, body.activity_id)])
      if (!p) return NextResponse.json({ error: 'Join the room first.' }, { status: 403 })
      const r = await respond(admin, cycleId, p, body.activity_id, body.value, activity)
      if (r.ok) return NextResponse.json({ ok: true, mine: r.mine }, { headers: NO_STORE })
      // A blocked word is a quiet drop, not an error: the phone just says so.
      if (r.blocked) return NextResponse.json({ ok: false, blocked: true, message: r.message, mine: r.mine }, { headers: NO_STORE })
      return NextResponse.json({ error: r.error }, { status: r.status })
    }
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
}
