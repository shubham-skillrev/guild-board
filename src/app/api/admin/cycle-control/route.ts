// ROUTE: PATCH /api/admin/cycle-control
// AUTH: admin only
// PURPOSE: Update cycle status (open | frozen | closed)
// DB TABLES: cycles, users
// RLS: admin client (bypasses RLS)

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { notifyOnCycleOpen, notifyOnCycleEnded, notifyAfterResponse } from '@/lib/push/notify'
import { NextResponse } from 'next/server'
import { sanitizeTheme } from '@/lib/themes'
import { closeCycle } from '@/lib/cycles/lifecycle'

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

  // Reopening an old month next to a newer one would leave two open boards,
  // and every reader picks the newest, so the reopened one would be invisible.
  if (status === 'open') {
    const { data: newer } = await adminClient
      .from('cycles')
      .select('id')
      .neq('id', cycle_id)
      .or(`year.gt.${cycle.year},and(year.eq.${cycle.year},month.gt.${cycle.month})`)
      .limit(1)
    if (newer?.length) {
      return NextResponse.json({ error: 'A later month already exists. Reopen only the latest cycle.' }, { status: 400 })
    }
  }

  let data
  if (status === 'closed') {
    data = await closeCycle(adminClient, cycle_id)
  } else {
    const updates: Record<string, unknown> = { status }
    if (status === 'open') updates.opens_at = new Date().toISOString()
    if (status === 'frozen') updates.freezes_at = new Date().toISOString()
    const { data: row, error } = await adminClient
      .from('cycles')
      .update(updates)
      .eq('id', cycle_id)
      .select()
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    data = row
  }

  // Fire notifications on meaningful transitions only.
  if (cycle.status !== status) {
    if (status === 'open') {
      notifyAfterResponse(notifyOnCycleOpen({ label: data.label, theme: sanitizeTheme(data.theme) }), "notifyOnCycleOpen")
    } else if (status === 'frozen' || status === 'closed') {
      // Closing is what starts the 48h spark window the message promises.
      notifyAfterResponse(notifyOnCycleEnded({ label: data.label }), "notifyOnCycleEnded")
    }
  }

  return NextResponse.json(data)
}
