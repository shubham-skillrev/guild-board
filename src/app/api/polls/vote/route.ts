// ROUTE: POST /api/polls/vote, DELETE /api/polls/vote
// AUTH: authenticated
// PURPOSE: Vote in a topic's poll, change that vote, or take it back.
//          Open while the board takes votes (same rule as upvotes).
// DB TABLES: poll_votes, topic_polls, topics, cycles
// RLS: session for identity only. poll_votes has no member grants (029):
//      who chose what is never readable, so every write is service role.

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { loadPolls } from '@/lib/polls'
import { isVotingAllowed } from '@/lib/utils/cycle'
import type { Cycle } from '@/types'

type Admin = ReturnType<typeof createAdminClient>

/** The poll's topic, if the poll exists, the topic is live and voting is open. */
async function openPoll(admin: Admin, pollId: string) {
  const { data: poll } = await admin
    .from('topic_polls')
    .select('id, topic_id, topics!inner(is_deleted, cycles!inner(status, meeting_at))')
    .eq('id', pollId)
    .maybeSingle()
  if (!poll) return { error: NextResponse.json({ error: 'Poll not found' }, { status: 404 }) }

  const topic = (Array.isArray(poll.topics) ? poll.topics[0] : poll.topics) as
    { is_deleted: boolean; cycles: Cycle | Cycle[] } | undefined
  const cycle = Array.isArray(topic?.cycles) ? topic?.cycles[0] : topic?.cycles
  if (!topic || topic.is_deleted) return { error: NextResponse.json({ error: 'Poll not found' }, { status: 404 }) }
  if (!isVotingAllowed(cycle ?? null)) {
    return { error: NextResponse.json({ error: 'Voting has closed for this cycle' }, { status: 409 }) }
  }
  return { topicId: poll.topic_id as string }
}

async function respond(admin: Admin, topicId: string, userId: string) {
  const polls = await loadPolls(admin, [topicId], userId, true)
  return NextResponse.json(polls.get(topicId) ?? null)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { poll_id?: string; option_id?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  const { poll_id, option_id } = body
  if (!poll_id || !option_id) return NextResponse.json({ error: 'poll_id and option_id required' }, { status: 400 })

  const admin = createAdminClient()
  const open = await openPoll(admin, poll_id)
  if ('error' in open) return open.error

  // One row per person per poll: voting again moves the vote. The option is
  // checked against the poll by a trigger (029).
  const { error } = await admin
    .from('poll_votes')
    .upsert(
      { poll_id, user_id: user.id, option_id, updated_at: new Date().toISOString() },
      { onConflict: 'poll_id,user_id' },
    )
  if (error) {
    if (error.message.includes('does not belong')) return NextResponse.json({ error: 'Invalid option' }, { status: 400 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return respond(admin, open.topicId, user.id)
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { poll_id?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }
  if (!body.poll_id) return NextResponse.json({ error: 'poll_id required' }, { status: 400 })

  const admin = createAdminClient()
  const open = await openPoll(admin, body.poll_id)
  if ('error' in open) return open.error

  const { error } = await admin.from('poll_votes').delete().eq('poll_id', body.poll_id).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return respond(admin, open.topicId, user.id)
}
