// ROUTE: POST /api/notifications/read  { id } | { all: true }
// AUTH: members
// PURPOSE: Mark one notification, or all of them, as read.
// DB TABLES: notifications

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  let body: { id?: unknown; all?: unknown } = {}
  try { body = await request.json() } catch { /* empty body */ }

  let q = createAdminClient().from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', user.id).is('read_at', null)
  if (body.all !== true) {
    if (typeof body.id !== 'string') return NextResponse.json({ error: 'id or all required' }, { status: 400 })
    q = q.eq('id', body.id)
  }
  const { error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
