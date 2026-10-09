// ROUTE: PATCH /api/profile/roast-me
// AUTH: authenticated
// PURPOSE: Opt in or out of GuildBot teasing you by @name in the app.
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

  let body: { roast_me?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  if (typeof body.roast_me !== 'boolean') return NextResponse.json({ error: 'roast_me must be true or false' }, { status: 400 })

  const { error } = await createAdminClient().from('users').update({ roast_me: body.roast_me }).eq('id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ roast_me: body.roast_me })
}
