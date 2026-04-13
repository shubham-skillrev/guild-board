// ROUTE: POST /api/admin/cycles
// AUTH: admin only
// PURPOSE: Create a new cycle
// DB TABLES: cycles, users
// RLS: admin client (bypasses RLS)

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (userData?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { label?: string; month?: number; year?: number; meeting_at?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { label, month, year, meeting_at } = body
  if (!label || !month || !year) {
    return NextResponse.json({ error: 'label, month, and year are required' }, { status: 400 })
  }
  if (month < 1 || month > 12) {
    return NextResponse.json({ error: 'month must be 1–12' }, { status: 400 })
  }

  const adminClient = createAdminClient()

  // Check for duplicate cycle in same month/year
  const { data: existing } = await adminClient
    .from('cycles')
    .select('id')
    .eq('month', month)
    .eq('year', year)
    .single()

  if (existing) {
    return NextResponse.json({ error: `A cycle for ${label} already exists` }, { status: 409 })
  }

  const insert: Record<string, unknown> = { label, month, year, status: 'open', opens_at: new Date().toISOString() }
  if (meeting_at) insert.meeting_at = meeting_at

  const { data, error } = await adminClient
    .from('cycles')
    .insert(insert)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (userData?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { cycle_id?: string; meeting_at?: string | null }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { cycle_id, meeting_at } = body
  if (!cycle_id) return NextResponse.json({ error: 'cycle_id is required' }, { status: 400 })

  const adminClient = createAdminClient()
  const updates: Record<string, unknown> = {}
  if (meeting_at !== undefined) updates.meeting_at = meeting_at

  const { data, error } = await adminClient
    .from('cycles')
    .update(updates)
    .eq('id', cycle_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (userData?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { cycle_id?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { cycle_id } = body
  if (!cycle_id) return NextResponse.json({ error: 'cycle_id is required' }, { status: 400 })

  const adminClient = createAdminClient()
  const { error } = await adminClient.from('cycles').delete().eq('id', cycle_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
