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
      .select('*')
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(12)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  // Return current active cycle: open > first upcoming > latest cycle
  const { data, error } = await supabase
    .from('cycles')
    .select('*')
    .in('status', ['open', 'upcoming', 'closed', 'frozen'])
    .order('year', { ascending: false })
    .order('month', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const cycle =
    data.find(c => c.status === 'open') ??
    data.find(c => c.status === 'upcoming') ??
    data[0] ??
    null

  return NextResponse.json(cycle)
}
