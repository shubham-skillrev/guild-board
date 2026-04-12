// ROUTE: PATCH /api/admin/cycle-control
// AUTH: admin only
// PURPOSE: Update cycle status (open | frozen | closed)
// DB TABLES: cycles, users
// RLS: admin client (bypasses RLS)

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify admin role
  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (userData?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { cycle_id?: string; status?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { cycle_id, status } = body
  if (!cycle_id || !status) return NextResponse.json({ error: 'cycle_id and status required' }, { status: 400 })

  const validStatuses = ['open', 'frozen', 'closed']
  if (!validStatuses.includes(status)) {
    return NextResponse.json({ error: `status must be one of: ${validStatuses.join(', ')}` }, { status: 400 })
  }

  const adminClient = createAdminClient()

  // Fetch current cycle to validate reopen restriction
  const { data: cycle } = await adminClient
    .from('cycles')
    .select('id, month, year, status')
    .eq('id', cycle_id)
    .single()

  if (!cycle) return NextResponse.json({ error: 'Cycle not found' }, { status: 404 })

  // Reopen restriction: can only reopen current month or previous month's cycle
  if (status === 'open' && cycle.status !== 'upcoming') {
    const now = new Date()
    const curMonth = now.getMonth() + 1 // 1-indexed
    const curYear = now.getFullYear()
    const prevMonth = curMonth === 1 ? 12 : curMonth - 1
    const prevYear = curMonth === 1 ? curYear - 1 : curYear

    const isCurrent = cycle.month === curMonth && cycle.year === curYear
    const isPrevious = cycle.month === prevMonth && cycle.year === prevYear

    if (!isCurrent && !isPrevious) {
      return NextResponse.json(
        { error: 'You can only reopen the current or previous month\'s cycle' },
        { status: 400 }
      )
    }
  }

  const updates: Record<string, unknown> = { status }

  // Set timestamps automatically based on status transition
  if (status === 'open') updates.opens_at = new Date().toISOString()
  if (status === 'frozen') updates.freezes_at = new Date().toISOString()
  if (status === 'closed') {
    const sparkClosesAt = new Date()
    sparkClosesAt.setHours(sparkClosesAt.getHours() + 48)
    updates.spark_closes_at = sparkClosesAt.toISOString()
  }

  const { data, error } = await adminClient
    .from('cycles')
    .update(updates)
    .eq('id', cycle_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
