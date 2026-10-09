// ROUTE: GET /api/topics/[id] - single topic
// AUTH: authenticated
// PURPOSE: Fetch topic detail + the viewer's vote

import { getViewer } from '@/lib/supabase/viewer'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { serializeTopic } from '@/lib/utils/anonymity'
import { loadPolls } from '@/lib/polls'
import { isVotingAllowed } from '@/lib/utils/cycle'
import type { Cycle } from '@/types'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const { supabase, user } = await getViewer()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Service role: members cannot select topics.user_id (028), which the
  // serializer needs to decide ownership and hide ghost authors.
  const admin = createAdminClient()
  const { data: topic, error } = await admin
    .from('topics')
    .select('id,cycle_id,user_id,is_anonymous,title,description,category,vote_count,contrib_count,comment_count,score,is_selected,is_deleted,status,outcome_tag,outcome_note,override_reason,created_at,updated_at,users!topics_user_id_fkey(username)')
    .eq('id', id)
    .eq('is_deleted', false)
    .single()

  if (error || !topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 })

  const [{ data: userVote }, { data: cycle }] = await Promise.all([
    supabase.from('votes').select('id').eq('user_id', user.id).eq('topic_id', id).maybeSingle(),
    admin.from('cycles').select('status, meeting_at').eq('id', topic.cycle_id).maybeSingle(),
  ])
  const polls = await loadPolls(admin, [id], user.id, isVotingAllowed(cycle as Cycle | null))

  return NextResponse.json({
    ...serializeTopic(topic, user.id),
    user_has_voted: !!userVote,
    poll: polls.get(id) ?? null,
  })
}
