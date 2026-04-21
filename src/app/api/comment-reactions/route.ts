// ROUTE: POST /api/comment-reactions, DELETE /api/comment-reactions
// AUTH: authenticated
// PURPOSE: Like / dislike a comment. One reaction per user per comment.
//          POST with same reaction = toggle off. POST with opposite = flip.

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { comment_id?: string; reaction?: number }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { comment_id, reaction } = body
  if (!comment_id || (reaction !== 1 && reaction !== -1)) {
    return NextResponse.json({ error: 'comment_id and reaction (1 or -1) required' }, { status: 400 })
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

  return NextResponse.json({ reaction }, { status: 201 })
}
