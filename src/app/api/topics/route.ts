// ROUTE: GET /api/topics, POST /api/topics
// AUTH: authenticated
// PURPOSE: GET all active topics for current cycle (with user vote/contrib status); POST submit new topic
// DB TABLES: topics, cycles, votes, contributions, users
// RLS: server client

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { notifyOnNewTopic, notifyAfterResponse } from '@/lib/push/notify'
import { serializeTopic } from '@/lib/utils/anonymity'
import type { CategoryTag } from '@/types'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const queryCycleId = url.searchParams.get('cycle_id')

  let cycleId: string | null = queryCycleId

  if (!cycleId) {
    // Get current active cycle
    const { data: cycle } = await supabase
      .from('cycles')
      .select('id')
      .eq('status', 'open')
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(1)
      .single()

    cycleId = cycle?.id ?? null
  }

  if (!cycleId) {
    return NextResponse.json([])
  }

  const { data: topics, error } = await supabase
    .from('topics')
    .select('id,cycle_id,user_id,is_anonymous,title,description,category,vote_count,contrib_count,comment_count,score,is_selected,is_deleted,status,outcome_tag,outcome_note,override_reason,created_at,updated_at,users!topics_user_id_fkey(username)')
    .eq('cycle_id', cycleId)
    .eq('is_deleted', false)
    .order('score', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Get current user's votes and contributions for this cycle
  const [{ data: userVotes }, { data: userContribs }] = await Promise.all([
    supabase.from('votes').select('topic_id').eq('user_id', user.id).eq('cycle_id', cycleId),
    supabase.from('contributions').select('topic_id').eq('user_id', user.id).eq('cycle_id', cycleId),
  ])

  const votedTopicIds = new Set((userVotes ?? []).map(v => v.topic_id))
  const contribTopicIds = new Set((userContribs ?? []).map(c => c.topic_id))

  const result = (topics ?? []).map((topic: any) => ({
    ...serializeTopic(topic, user.id),
    user_has_voted: votedTopicIds.has(topic.id),
    user_has_contribed: contribTopicIds.has(topic.id),
  }))

  return NextResponse.json(result)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { title?: string; description?: string; category?: CategoryTag; is_anonymous?: boolean }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { title, description, category, is_anonymous } = body

  if (!title?.trim() || !description?.trim() || !category) {
    return NextResponse.json({ error: 'title, description, and category are required' }, { status: 400 })
  }
  if (title.length > 80) return NextResponse.json({ error: 'Title too long' }, { status: 400 })
  if (description.length > 1000) return NextResponse.json({ error: 'Description too long (max 1000 characters)' }, { status: 400 })

  // Get current open cycle — most recent by year/month
  const { data: cycle } = await supabase
    .from('cycles')
    .select('id, status')
    .eq('status', 'open')
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(1)
    .single()

  if (!cycle) {
    return NextResponse.json({ error: 'No open cycle' }, { status: 400 })
  }

  // DB trigger enforces 1 topic per user per cycle — insert will fail if limit exceeded
  const { data, error } = await supabase
    .from('topics')
    .insert({
      cycle_id: cycle.id,
      user_id: user.id,
      title,
      description,
      category,
      is_anonymous: is_anonymous === true,
    })
    .select()
    .single()

  if (error) {
    if (error.message.includes('Topic limit reached')) {
      return NextResponse.json({ error: 'You have already submitted a topic this cycle' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  notifyAfterResponse(notifyOnNewTopic({ topicId: data.id, actorId: user.id }), "notifyOnNewTopic")

  return NextResponse.json(data, { status: 201 })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { id?: string; title?: string; description?: string; category?: CategoryTag }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { id, title, description, category } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const admin = createAdminClient()

  const { data: existing, error: existingErr } = await admin
    .from('topics')
    .select('user_id, cycle_id, is_deleted')
    .eq('id', id)
    .maybeSingle()

  if (existingErr) return NextResponse.json({ error: existingErr.message }, { status: 500 })
  if (!existing || existing.is_deleted) return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  if (existing.user_id !== user.id) return NextResponse.json({ error: 'Not your topic' }, { status: 403 })

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (title?.trim()) {
    if (title.length > 80) return NextResponse.json({ error: 'Title too long' }, { status: 400 })
    updates.title = title.trim()
  }
  if (description?.trim()) {
    if (description.length > 1000) return NextResponse.json({ error: 'Description too long (max 1000 characters)' }, { status: 400 })
    updates.description = description.trim()
  }
  if (category) updates.category = category

  const { data, error } = await admin
    .from('topics')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { id?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { id } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const admin = createAdminClient()

  const { data: existing, error: existingErr } = await admin
    .from('topics')
    .select('user_id, is_deleted')
    .eq('id', id)
    .maybeSingle()

  if (existingErr) return NextResponse.json({ error: existingErr.message }, { status: 500 })
  if (!existing || existing.is_deleted) return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  if (existing.user_id !== user.id) return NextResponse.json({ error: 'Not your topic' }, { status: 403 })

  const { data: updated, error } = await admin
    .from('topics')
    .update({ is_deleted: true, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: 'Delete did not affect any row' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
