// ROUTE: GET /api/comments?topic_id=..., POST /api/comments, PATCH /api/comments, DELETE /api/comments
// AUTH: authenticated
// PURPOSE: CRUD for threaded comments on topics

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const COMMENT_MAX_LENGTH = 2000

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const topicId = url.searchParams.get('topic_id')
  if (!topicId) return NextResponse.json({ error: 'topic_id required' }, { status: 400 })

  const { data: comments, error } = await supabase
    .from('comments')
    .select('*, users!comments_user_id_fkey(username)')
    .eq('topic_id', topicId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Build threaded structure
  const flat = (comments ?? []).map((c: any) => ({
    ...c,
    author_username: c.users?.username ?? 'unknown',
    users: undefined,
    replies: [] as any[],
  }))

  const map = new Map<string, any>()
  const roots: any[] = []

  for (const c of flat) map.set(c.id, c)
  for (const c of flat) {
    if (c.parent_id && map.has(c.parent_id)) {
      map.get(c.parent_id)!.replies.push(c)
    } else {
      roots.push(c)
    }
  }

  return NextResponse.json(roots)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { topic_id?: string; parent_id?: string | null; body?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { topic_id, parent_id = null, body: commentBody } = body
  if (!topic_id || !commentBody?.trim()) {
    return NextResponse.json({ error: 'topic_id and body required' }, { status: 400 })
  }
  if (commentBody.length > COMMENT_MAX_LENGTH) {
    return NextResponse.json({ error: `Comment must be under ${COMMENT_MAX_LENGTH} characters` }, { status: 400 })
  }

  // Verify topic exists and is not deleted
  const { data: topic } = await supabase
    .from('topics')
    .select('id')
    .eq('id', topic_id)
    .eq('is_deleted', false)
    .single()

  if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 })

  // If replying, verify parent exists
  if (parent_id) {
    const { data: parent } = await supabase
      .from('comments')
      .select('id')
      .eq('id', parent_id)
      .eq('is_deleted', false)
      .single()

    if (!parent) return NextResponse.json({ error: 'Parent comment not found' }, { status: 404 })
  }

  const { data, error } = await supabase
    .from('comments')
    .insert({
      topic_id,
      user_id: user.id,
      parent_id,
      body: commentBody.trim(),
    })
    .select('*, users!comments_user_id_fkey(username)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({
    ...data,
    author_username: data.users?.username ?? 'unknown',
    users: undefined,
    replies: [],
  }, { status: 201 })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { id?: string; body?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { id, body: newBody } = body
  if (!id || !newBody?.trim()) {
    return NextResponse.json({ error: 'id and body required' }, { status: 400 })
  }
  if (newBody.length > COMMENT_MAX_LENGTH) {
    return NextResponse.json({ error: `Comment must be under ${COMMENT_MAX_LENGTH} characters` }, { status: 400 })
  }

  // RLS ensures only owner can update
  const { data, error } = await supabase
    .from('comments')
    .update({ body: newBody.trim(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Comment not found or not yours' }, { status: 404 })

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

  // Soft delete — RLS ensures only owner
  const { data, error } = await supabase
    .from('comments')
    .update({ is_deleted: true, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Comment not found or not yours' }, { status: 404 })

  return NextResponse.json({ success: true })
}
