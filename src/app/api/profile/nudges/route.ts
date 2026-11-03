// ROUTE: PATCH /api/profile/nudges
// AUTH: authenticated
// PURPOSE: The member's "No nudges" switch: when on, guild organisers can't
//          send them a nudge (push or board card), ever.
// DB TABLES: users
// RLS: session for identity; the write uses the service role because members
//      may only update their own username directly (migration 028).

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { nudges_off?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  if (typeof body.nudges_off !== 'boolean') return NextResponse.json({ error: 'nudges_off must be true or false' }, { status: 400 })

  const { error } = await createAdminClient().from('users').update({ nudges_off: body.nudges_off }).eq('id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ nudges_off: body.nudges_off })
}
