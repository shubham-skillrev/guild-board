// ROUTE: POST /api/comment-reactions, DELETE /api/comment-reactions
// AUTH: authenticated
// PURPOSE: Like a comment. One reaction per user per comment; POST with the
//          same reaction toggles it off.
// NOTE: dislike (-1) is rejected. A public downvote of a named colleague on a
//       30-person company board is the kind of exposure that keeps quiet
//       members quiet. The table and its CHECK still allow -1 and existing
//       rows are untouched, so this is reversible.
// DB TABLES: comment_reactions, comments
// RLS: server client

import { createClient } from '@/lib/supabase/server'
import { notifyOnLike, notifyAfterResponse } from '@/lib/push/notify'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { comment_id?: string; reaction?: number }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { comment_id, reaction } = body
  if (!comment_id || reaction !== 1) {
    return NextResponse.json({ error: 'comment_id and reaction (1) required' }, { status: 400 })
  }

  // Verify comment exists and is not deleted
  const { data: comment } = await supabase
    .from('comments')
    .select('id')
    .eq('id', comment_id)
    .eq('is_deleted', false)
    .single()

  if (!comment) return NextResponse.json({ error: 'Comment not found' }, { status: 404 })

  // Check existing reaction
  const { data: existing } = await supabase
    .from('comment_reactions')
    .select('id, reaction')
    .eq('comment_id', comment_id)
    .eq('user_id', user.id)
    .single()

  if (existing) {
    if (existing.reaction === reaction) {
      // Same reaction — toggle off
      await supabase.from('comment_reactions').delete().eq('id', existing.id)
      return NextResponse.json({ reaction: null })
    } else {
      // Opposite reaction — flip
      await supabase
        .from('comment_reactions')
        .update({ reaction })
        .eq('id', existing.id)
      return NextResponse.json({ reaction })
    }
  }

  // New reaction
  const { error } = await supabase
    .from('comment_reactions')
    .insert({ comment_id, user_id: user.id, reaction })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (reaction === 1) {
    notifyAfterResponse(notifyOnLike({ commentId: comment_id, actorId: user.id }), "notifyOnLike")
  }

  return NextResponse.json({ reaction }, { status: 201 })
}
