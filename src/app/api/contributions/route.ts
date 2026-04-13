// ROUTE: POST /api/contributions, DELETE /api/contributions
// AUTH: authenticated
// PURPOSE: Flag or unflag willingness to contribute to a topic
// DB TABLES: contributions, cycles, topics
// RLS: server client

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { topic_id?: string; cycle_id?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { topic_id, cycle_id } = body
  if (!topic_id || !cycle_id) return NextResponse.json({ error: 'topic_id and cycle_id required' }, { status: 400 })

  const { data: cycle } = await supabase.from('cycles').select('status, meeting_at').eq('id', cycle_id).single()
  if (cycle?.status !== 'open') return NextResponse.json({ error: 'Contributions are not open' }, { status: 400 })
  if (cycle.meeting_at && new Date() >= new Date(cycle.meeting_at)) {
    return NextResponse.json({ error: 'Contributions are locked after the cycle date' }, { status: 400 })
  }

  // DB trigger enforces contribution limit
  const { data, error } = await supabase
    .from('contributions')
    .insert({ topic_id, user_id: user.id, cycle_id })
    .select()
    .single()

  if (error) {
    if (error.message.includes('Contribution limit reached')) {
      return NextResponse.json({ error: 'Contribution limit reached: max 2 per cycle' }, { status: 409 })
    }
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Already flagged this topic' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { topic_id?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { topic_id } = body
  if (!topic_id) return NextResponse.json({ error: 'topic_id required' }, { status: 400 })

  const { data: topic } = await supabase.from('topics').select('cycle_id').eq('id', topic_id).single()
  if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 })

  const { data: cycle } = await supabase.from('cycles').select('status, meeting_at').eq('id', topic.cycle_id).single()
  if (cycle?.status !== 'open') return NextResponse.json({ error: 'Contributions are not open' }, { status: 400 })
  if (cycle.meeting_at && new Date() >= new Date(cycle.meeting_at)) {
    return NextResponse.json({ error: 'Contributions are locked after the cycle date' }, { status: 400 })
  }

  const { error } = await supabase
    .from('contributions')
    .delete()
    .eq('topic_id', topic_id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
