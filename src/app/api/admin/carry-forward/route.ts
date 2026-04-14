// ROUTE: POST /api/admin/carry-forward
// AUTH: admin only
// PURPOSE: Mark topics with enough votes as carry_forward and copy them into the next open cycle
// DB TABLES: topics, cycles, users
// RLS: admin client (bypasses RLS)

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { CARRY_FORWARD_MIN_VOTES } from '@/lib/constants'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (userData?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { cycle_id?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { cycle_id } = body
  if (!cycle_id) return NextResponse.json({ error: 'cycle_id required' }, { status: 400 })

  const admin = createAdminClient()

  // Verify cycle is closed
  const { data: cycle } = await admin.from('cycles').select('*').eq('id', cycle_id).single()
  if (!cycle) return NextResponse.json({ error: 'Cycle not found' }, { status: 404 })
  if (cycle.status !== 'closed') {
    return NextResponse.json({ error: 'Cycle must be closed before running carry-forward' }, { status: 400 })
  }

  // Find the next upcoming/open cycle
  const { data: nextCycle } = await admin
    .from('cycles')
    .select('id, label')
    .in('status', ['upcoming', 'open'])
    .or(`year.gt.${cycle.year},and(year.eq.${cycle.year},month.gt.${cycle.month})`)
    .order('year', { ascending: true })
    .order('month', { ascending: true })
    .limit(1)
    .single()

  if (!nextCycle) {
    return NextResponse.json({ error: 'No upcoming cycle found to carry topics forward into' }, { status: 400 })
  }

  // Get non-selected topics with enough votes that aren't already carried forward
  const { data: eligibleTopics } = await admin
    .from('topics')
    .select('*')
    .eq('cycle_id', cycle_id)
    .eq('is_deleted', false)
    .eq('is_selected', false)
    .neq('status', 'carry_forward')
    .neq('status', 'dropped')
    .gte('vote_count', CARRY_FORWARD_MIN_VOTES)

  if (!eligibleTopics?.length) {
    return NextResponse.json({ message: 'No eligible topics for carry-forward', carried: 0 })
  }

  // Mark originals as carry_forward
  await admin
    .from('topics')
    .update({ status: 'carry_forward' })
    .in('id', eligibleTopics.map(t => t.id))

  // Insert copies into the next cycle (reset vote/contrib/score counters)
  const copies = eligibleTopics.map(t => ({
    cycle_id: nextCycle.id,
    user_id: t.user_id,
    is_anonymous: t.is_anonymous,
    title: t.title,
    description: t.description,
    category: t.category,
    vote_count: 0,
    contrib_count: 0,
    score: 0,
    is_selected: false,
    is_deleted: false,
    status: 'active',
    is_carry_forward: true,
    override_reason: `Carried forward from ${cycle.label}`,
  }))

  const { data: inserted, error: insertError } = await admin
    .from('topics')
    .insert(copies)
    .select('id')

  if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })

  return NextResponse.json({
    message: `${inserted?.length ?? 0} topics carried forward into ${nextCycle.label}`,
    carried: inserted?.length ?? 0,
    into_cycle: nextCycle.label,
  })
}
