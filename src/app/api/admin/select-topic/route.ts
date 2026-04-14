// ROUTE: PATCH /api/admin/select-topic
// AUTH: admin only
// PURPOSE: Mark a topic as selected (or deselect) for the meeting
// DB TABLES: topics, users
// RLS: admin client (bypasses RLS)

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { MAX_SELECTED_TOPICS } from '@/lib/constants'
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

  // Enforce MAX_SELECTED_TOPICS cap when selecting
  if (is_selected) {
    // Look up the cycle_id for this topic
    const { data: topicRow } = await adminClient
      .from('topics')
      .select('cycle_id')
      .eq('id', topic_id)
      .single()

    if (!topicRow) return NextResponse.json({ error: 'Topic not found' }, { status: 404 })

    const { count } = await adminClient
      .from('topics')
      .select('id', { count: 'exact', head: true })
      .eq('cycle_id', topicRow.cycle_id)
      .eq('is_selected', true)
      .eq('is_deleted', false)

    if ((count ?? 0) >= MAX_SELECTED_TOPICS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_SELECTED_TOPICS} topics can be selected per cycle` },
        { status: 400 }
      )
    }
  }

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
