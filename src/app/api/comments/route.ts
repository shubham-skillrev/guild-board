// ROUTE: GET /api/comments?topic_id=..., POST /api/comments, PATCH /api/comments, DELETE /api/comments
// AUTH: authenticated
// PURPOSE: CRUD for threaded comments on topics
// RLS: comments are read and written with the service role. Members cannot
//      select comments.user_id (028); serializeComment turns it into
//      is_owner / is_op / can_delete and a ghost handle where needed.

import { createClient } from '@/lib/supabase/server'
import { getViewer } from '@/lib/supabase/viewer'
import { createAdminClient } from '@/lib/supabase/admin'
import { notifyOnComment, notifyAfterResponse } from '@/lib/push/notify'
import { commentIsGhost, ghostHandle, serializeComment, withoutAuthor } from '@/lib/utils/anonymity'
import { broadcastTopicChange } from '@/lib/realtime/broadcast'
import { NextResponse } from 'next/server'

const COMMENT_MAX_LENGTH = 2000

type Admin = ReturnType<typeof createAdminClient>

type ThreadComment = {
  id: string
  parent_id: string | null
  replies: ThreadComment[]
  [key: string]: unknown
}

async function isAdmin(admin: Admin, userId: string): Promise<boolean> {
  const { data } = await admin.from('users').select('role').eq('id', userId).maybeSingle()
  return data?.role === 'admin'
}

export async function GET(request: Request) {
  const { supabase, user, isGuest } = await getViewer()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const topicId = url.searchParams.get('topic_id')
  if (!topicId) return NextResponse.json({ error: 'topic_id required' }, { status: 400 })

  const admin = createAdminClient()

  const [{ data: topic }, { data: comments, error }, viewerIsAdmin] = await Promise.all([
    admin.from('topics').select('id, user_id, is_anonymous').eq('id', topicId).eq('is_deleted', false).maybeSingle(),
    admin
      .from('comments')
      .select('*, users!comments_user_id_fkey(username)')
      .eq('topic_id', topicId)
      .eq('is_deleted', false)
      .order('created_at', { ascending: true }),
    isGuest ? Promise.resolve(false) : isAdmin(admin, user.id),
  ])

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!topic) return NextResponse.json([])

  // Fetch current user's reactions for these comments in one query
  const commentIds = (comments ?? []).map(c => c.id)
  const userReactions: Record<string, number> = {}
  if (commentIds.length > 0) {
    const { data: reactions } = await supabase
      .from('comment_reactions')
      .select('comment_id, reaction')
      .eq('user_id', user.id)
      .in('comment_id', commentIds)
    for (const r of reactions ?? []) {
      userReactions[r.comment_id] = r.reaction
    }
  }

  // Build threaded structure
  const viewer = { id: user.id, isAdmin: viewerIsAdmin }
  const flat: ThreadComment[] = (comments ?? []).map(c => ({
    ...serializeComment(c, topic, viewer),
    id: c.id,
    parent_id: c.parent_id,
    user_reaction: userReactions[c.id] ?? null,
    replies: [],
  }))

  const map = new Map<string, ThreadComment>()
  const roots: ThreadComment[] = []

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

  let body: { topic_id?: string; parent_id?: string | null; body?: string; is_anonymous?: boolean }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { topic_id, parent_id = null, body: commentBody } = body
  if (!topic_id || !commentBody?.trim()) {
    return NextResponse.json({ error: 'topic_id and body required' }, { status: 400 })
  }
  if (commentBody.length > COMMENT_MAX_LENGTH) {
    return NextResponse.json({ error: `Comment must be under ${COMMENT_MAX_LENGTH} characters` }, { status: 400 })
  }

  const admin = createAdminClient()

  // Verify topic exists and is not deleted
  const { data: topic } = await admin
    .from('topics')
    .select('id, user_id, is_anonymous')
    .eq('id', topic_id)
    .eq('is_deleted', false)
    .single()

  if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 })

  // If replying, verify parent exists
  if (parent_id) {
    const { data: parent } = await admin
      .from('comments')
      .select('id')
      .eq('id', parent_id)
      .eq('is_deleted', false)
      .single()

    if (!parent) return NextResponse.json({ error: 'Parent comment not found' }, { status: 404 })
  }

  // Stored as a ghost when asked for, and always for a ghost topic's own
  // author, so the row says what the thread shows.
  const isGhost = commentIsGhost({ user_id: user.id, is_anonymous: body.is_anonymous === true }, topic)

  const { data, error } = await admin
    .from('comments')
    .insert({
      topic_id,
      user_id: user.id,
      parent_id,
      body: commentBody.trim(),
      is_anonymous: isGhost,
    })
    .select('*, users!comments_user_id_fkey(username)')
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  notifyAfterResponse(notifyOnComment({
    topicId: topic_id,
    parentCommentId: parent_id,
    actorId: user.id,
    // A ghost is named by its handle in the push, never by username.
    actorLabel: isGhost ? ghostHandle(user.id, topic_id) : undefined,
    body: commentBody.trim(),
  }), "notifyOnComment")
  broadcastTopicChange(topic_id, ['counts', 'comments'])

  return NextResponse.json({
    ...serializeComment(data, topic, { id: user.id, isAdmin: false }),
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

  const { data, error } = await createAdminClient()
    .from('comments')
    .update({ body: newBody.trim(), updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Comment not found or not yours' }, { status: 404 })

  broadcastTopicChange(data.topic_id, ['comments'])
  return NextResponse.json({ ...withoutAuthor(data), is_owner: true })
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

  // Authors delete their own comments; admins may hide anyone's, ghosts
  // included. Either way the response says nothing about who wrote it.
  let query = admin
    .from('comments')
    .update({ is_deleted: true, updated_at: new Date().toISOString() })
    .eq('id', id)
  if (!(await isAdmin(admin, user.id))) query = query.eq('user_id', user.id)

  const { data, error } = await query.select('id, topic_id').maybeSingle()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: 'Comment not found or not yours' }, { status: 404 })

  broadcastTopicChange(data.topic_id, ['counts', 'comments'])
  return NextResponse.json({ success: true })
}
