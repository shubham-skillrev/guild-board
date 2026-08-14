// ROUTE: POST /api/byte-interests
// AUTH: authenticated
// PURPOSE: One-tap "I'd discuss this" on a byte. Zero writing, zero social
//          risk, available any day of the month — and it's the ranking signal
//          the admin uses to decide which byte becomes a topic.
// DB TABLES: byte_interests
// RLS: server client

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { byte_id?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { byte_id } = body
  if (!byte_id) return NextResponse.json({ error: 'byte_id required' }, { status: 400 })

  const { data: existing } = await supabase
    .from('byte_interests')
    .select('byte_id')
    .eq('byte_id', byte_id)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('byte_interests')
      .delete()
      .eq('byte_id', byte_id)
      .eq('user_id', user.id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ interested: false })
  }

  const { error } = await supabase
    .from('byte_interests')
    .insert({ byte_id, user_id: user.id })

  if (error) {
    // Double-tap race — the row exists, which is what the caller wanted.
    if (error.code === '23505') return NextResponse.json({ interested: true })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ interested: true })
}
