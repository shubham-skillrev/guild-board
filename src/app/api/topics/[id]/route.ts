// ROUTE: GET /api/topics/[id] — single topic with contributors
// AUTH: authenticated
// PURPOSE: Fetch topic detail + contributor list

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

function getJoinedUser(joinedUser: unknown): { username?: string } | null {
  if (Array.isArray(joinedUser)) {
    return (joinedUser[0] as { username?: string } | undefined) ?? null
  }

  if (joinedUser && typeof joinedUser === 'object') {
    return joinedUser as { username?: string }
  }

  return null
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch topic
  const { data: topic, error } = await supabase
    .from('topics')
    .select('id,cycle_id,user_id,is_anonymous,title,description,category,vote_count,contrib_count,comment_count,score,is_selected,is_deleted,status,outcome_tag,outcome_note,override_reason,created_at,updated_at,users!topics_user_id_fkey(username)')
    .eq('id', id)
    .eq('is_deleted', false)
    .single()

  if (error || !topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 })

  // Fetch contributors with usernames
  const { data: contribs } = await supabase
    .from('contributions')
    .select('user_id, users!contributions_user_id_fkey(username)')
    .eq('topic_id', id)

  const contributors = (contribs ?? []).map((c: any) => ({
    user_id: c.user_id,
    username: getJoinedUser(c.users)?.username ?? 'unknown',
  }))

  // Check current user's vote/contrib status
  const [{ data: userVote }, { data: userContrib }] = await Promise.all([
    supabase.from('votes').select('id').eq('user_id', user.id).eq('topic_id', id).maybeSingle(),
    supabase.from('contributions').select('id').eq('user_id', user.id).eq('topic_id', id).maybeSingle(),
  ])

  return NextResponse.json({
    ...topic,
    author_username: getJoinedUser(topic.users)?.username ?? 'unknown',
    users: undefined,
    user_has_voted: !!userVote,
    user_has_contribed: !!userContrib,
    contributors,
  })
}
