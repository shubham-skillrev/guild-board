// ROUTE: PATCH /api/nudges/[id]  { stop?: boolean }
// AUTH: the note's recipient
// PURPOSE: Close a note from the organisers. With stop: true, also turn on
//          "No nudges" so none are sent again.
// DB TABLES: nudges, users

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { stop?: unknown } = {}
  try { body = await request.json() } catch { /* empty body */ }

  const admin = createAdminClient()
  const { error } = await admin.from('nudges').update({ seen_at: new Date().toISOString() }).eq('id', id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (body.stop === true) await admin.from('users').update({ nudges_off: true }).eq('id', user.id)
  return NextResponse.json({ ok: true })
}
