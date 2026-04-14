// ROUTE: GET /api/sparks?cycle_id=... | POST /api/sparks
// AUTH: authenticated
// PURPOSE: Check spark status (GET) or award a spark (POST)
// DB TABLES: sparks, cycles, users
// RLS: server client

import { createClient } from '@/lib/supabase/server'
import { type NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const cycleId = request.nextUrl.searchParams.get('cycle_id')
  if (!cycleId) return NextResponse.json({ error: 'cycle_id required' }, { status: 400 })

  const { data: spark } = await supabase
    .from('sparks')
    .select('to_user_id')
    .eq('from_user_id', user.id)
    .eq('cycle_id', cycleId)
    .maybeSingle()

  return NextResponse.json({ sparked_user_id: spark?.to_user_id ?? null })
}

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

  // Spark is available once the cycle meeting date has passed,
  // including the 48h window after cycle closure.
  const { data: cycle } = await supabase.from('cycles').select('status, meeting_at, spark_closes_at').eq('id', cycle_id).single()

  if (!cycle) {
    return NextResponse.json({ error: 'Cycle not found' }, { status: 400 })
  }

  const now = new Date()
  const isOpenAfterMeeting = cycle.status === 'open' && cycle.meeting_at && now >= new Date(cycle.meeting_at)
  const isClosedInWindow = cycle.status === 'closed' && cycle.spark_closes_at && now < new Date(cycle.spark_closes_at)

  if (!isOpenAfterMeeting && !isClosedInWindow) {
    return NextResponse.json({ error: 'Spark window is not active' }, { status: 400 })
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
