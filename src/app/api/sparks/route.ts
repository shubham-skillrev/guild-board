// ROUTE: POST /api/sparks
// AUTH: authenticated
// PURPOSE: Award a spark to another user during the spark window
// DB TABLES: sparks, cycles, users
// RLS: server client

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { to_user_id?: string; cycle_id?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { to_user_id, cycle_id } = body
  if (!to_user_id || !cycle_id) return NextResponse.json({ error: 'to_user_id and cycle_id required' }, { status: 400 })

  if (to_user_id === user.id) {
    return NextResponse.json({ error: 'Cannot give a spark to yourself' }, { status: 400 })
  }

  // Validate spark window: cycle must be closed and spark_closes_at in the future
  const { data: cycle } = await supabase.from('cycles').select('status, spark_closes_at').eq('id', cycle_id).single()

  if (!cycle || cycle.status !== 'closed') {
    return NextResponse.json({ error: 'Spark window is not active' }, { status: 400 })
  }
  if (!cycle.spark_closes_at || new Date() >= new Date(cycle.spark_closes_at)) {
    return NextResponse.json({ error: 'Spark window has closed' }, { status: 400 })
  }

  // DB trigger enforces 1 spark per user per cycle via UNIQUE(from_user_id, cycle_id)
  const { data, error } = await supabase
    .from('sparks')
    .insert({ from_user_id: user.id, to_user_id, cycle_id })
    .select()
    .single()

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'You have already given a spark this cycle' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
