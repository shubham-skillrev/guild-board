// ROUTE: PATCH /api/admin/roles  { user_id, viewer: boolean }
// AUTH: admin only
// PURPOSE: Let someone see the control room's analytics read-only (or stop).
//          Never changes an admin, and never makes anyone an admin.
// DB TABLES: users

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminId } from '@/lib/guild/staff'

export async function PATCH(request: Request) {
  if (!(await getAdminId())) return new NextResponse(null, { status: 404 })
  let body: { user_id?: unknown; viewer?: unknown } = {}
  try { body = await request.json() } catch { /* empty body */ }
  if (typeof body.user_id !== 'string' || typeof body.viewer !== 'boolean') {
    return NextResponse.json({ error: 'user_id and viewer required' }, { status: 400 })
  }
  const admin = createAdminClient()
  const { data: person } = await admin.from('users').select('role').eq('id', body.user_id).maybeSingle()
  if (!person) return NextResponse.json({ error: 'No such member' }, { status: 404 })
  if (person.role === 'admin') return NextResponse.json({ error: 'Admins already see everything.' }, { status: 400 })

  const { error } = await admin.from('users').update({ role: body.viewer ? 'viewer' : 'user' }).eq('id', body.user_id)
  if (error) {
    return NextResponse.json({ error: /role_check/.test(error.message) ? 'Apply migration 043 first.' : error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
