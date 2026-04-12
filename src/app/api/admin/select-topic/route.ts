// ROUTE: PATCH /api/admin/select-topic
// AUTH: admin only
// PURPOSE: Mark a topic as selected (or deselect) for the meeting
// DB TABLES: topics, users
// RLS: admin client (bypasses RLS)

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (userData?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { topic_id?: string; is_selected?: boolean; override_reason?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { topic_id, is_selected, override_reason } = body
  if (!topic_id || is_selected === undefined) {
    return NextResponse.json({ error: 'topic_id and is_selected required' }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const updates: Record<string, unknown> = {
    is_selected,
    status: is_selected ? 'selected' : 'active',
  }
  if (override_reason !== undefined) updates.override_reason = override_reason

  const { data, error } = await adminClient
    .from('topics')
    .update(updates)
    .eq('id', topic_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
