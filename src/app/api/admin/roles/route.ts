// ROUTE: PATCH /api/admin/roles  { user_id, role: 'viewer' | 'user' | 'admin' }
//        (older callers: { user_id, viewer: boolean })
// AUTH: admin only
// PURPOSE: Let someone see the control room's analytics read-only, take it
//          away again, or make them an admin. An admin can't be changed here
//          (no accidental demotions). Being given a role sends a push and a
//          notification; losing one is silent.
// DB TABLES: users, notifications

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminId } from '@/lib/guild/staff'
import { sendPushToUser } from '@/lib/push/send'

const GRANTED = {
  viewer: { title: 'You can now see the guild’s analytics', body: 'Pulse, People, Topics and the survey, read-only. Find them under Analytics in the top bar.' },
  admin: { title: 'You’re now a guild admin', body: 'You can run the guild: the meeting, Show & Tell, nudges and the rest. Find it all under Admin.' },
} as const

export async function PATCH(request: Request) {
  if (!(await getAdminId())) return new NextResponse(null, { status: 404 })
  let body: { user_id?: unknown; viewer?: unknown; role?: unknown } = {}
  try { body = await request.json() } catch { /* empty body */ }

  const role =
    body.role === 'viewer' || body.role === 'user' || body.role === 'admin' ? body.role
    : typeof body.viewer === 'boolean' ? (body.viewer ? 'viewer' : 'user')
    : null
  if (typeof body.user_id !== 'string' || !role) {
    return NextResponse.json({ error: 'user_id and role required' }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: person } = await admin.from('users').select('role').eq('id', body.user_id).maybeSingle()
  if (!person) return NextResponse.json({ error: 'No such member' }, { status: 404 })
  if (person.role === 'admin') return NextResponse.json({ error: 'Admins already see everything.' }, { status: 400 })
  if (person.role === role) return NextResponse.json({ ok: true })

  const { error } = await admin.from('users').update({ role }).eq('id', body.user_id)
  if (error) {
    return NextResponse.json({ error: /role_check/.test(error.message) ? 'Apply migration 043 first.' : error.message }, { status: 500 })
  }
  if (role === 'viewer' || role === 'admin') {
    await sendPushToUser(body.user_id, { ...GRANTED[role], url: '/admin', tag: `role:${role}` }).catch(() => {})
  }
  return NextResponse.json({ ok: true })
}
