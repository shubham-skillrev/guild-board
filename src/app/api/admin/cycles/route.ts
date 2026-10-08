// ROUTE: POST /api/admin/cycles
// AUTH: admin only
// PURPOSE: Create a new cycle
// DB TABLES: cycles, users
// RLS: admin client (bypasses RLS)

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { notifyOnCycleOpen, notifyAfterResponse } from '@/lib/push/notify'
import { NextResponse } from 'next/server'
import { sanitizeTheme } from '@/lib/themes'
import { createCycle } from '@/lib/cycles/lifecycle'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (userData?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { label?: string; month?: number; year?: number; meeting_at?: string; theme?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { label, month, year, meeting_at } = body
  // Picked in the create form, so the cycle-open message below can carry it.
  // Anything malformed is dropped rather than refused: a theme is optional.
  const theme = sanitizeTheme(body.theme)
  if (!label || !month || !year) {
    return NextResponse.json({ error: 'label, month, and year are required' }, { status: 400 })
  }
  if (month < 1 || month > 12) {
    return NextResponse.json({ error: 'month must be 1–12' }, { status: 400 })
  }

  const result = await createCycle(createAdminClient(), { year, month, label, meetingAt: meeting_at, theme })
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: 409 })
  const data = result.cycle

  notifyAfterResponse(notifyOnCycleOpen({ label: data.label, theme: sanitizeTheme(data.theme) }), "notifyOnCycleOpen")

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
