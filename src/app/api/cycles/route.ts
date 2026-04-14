// ROUTE: GET /api/cycles
// AUTH: authenticated
// PURPOSE: Return current active cycle; admin gets all cycles
// DB TABLES: cycles
// RLS: server client

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const allParam = url.searchParams.get('all')
  const isAdminRequest = request.headers.get('x-admin') === 'true'

  // Return all cycles (for board tabs or admin)
  if (allParam === 'true' || isAdminRequest) {
    if (isAdminRequest) {
      const { data: userData } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .single()

      if (userData?.role !== 'admin') {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const { data, error } = await supabase
      .from('cycles')
      .select('id,label,month,year,status,opens_at,freezes_at,meeting_at,spark_closes_at,created_at')
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(12)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  // Return current active cycle: open > first upcoming > latest cycle
  const selectColumns = 'id,label,month,year,status,opens_at,freezes_at,meeting_at,spark_closes_at,created_at'

  const { data: openCycle, error: openError } = await supabase
    .from('cycles')
    .select(selectColumns)
    .eq('status', 'open')
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (openError) return NextResponse.json({ error: openError.message }, { status: 500 })
  if (openCycle) return NextResponse.json(openCycle)

  // Check for a closed cycle still within its spark window
  const { data: sparkCycle } = await supabase
    .from('cycles')
    .select(selectColumns)
    .eq('status', 'closed')
    .gt('spark_closes_at', new Date().toISOString())
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (sparkCycle) return NextResponse.json(sparkCycle)

  const { data: upcomingCycle, error: upcomingError } = await supabase
    .from('cycles')
    .select(selectColumns)
    .eq('status', 'upcoming')
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (upcomingError) return NextResponse.json({ error: upcomingError.message }, { status: 500 })
  if (upcomingCycle) return NextResponse.json(upcomingCycle)

  const { data: latestCycle, error: latestError } = await supabase
    .from('cycles')
    .select(selectColumns)
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (latestError) return NextResponse.json({ error: latestError.message }, { status: 500 })

  return NextResponse.json(latestCycle ?? null)
}
