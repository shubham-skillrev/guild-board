// ROUTE: GET /api/topic-signals, POST /api/topic-signals
// AUTH: authenticated
// PURPOSE: One-tap signals on a topic. Unlimited, unscored, and available in
//          every cycle phase - including the post-meeting lock, when nothing
//          else on the board can be interacted with.
// DB TABLES: topic_signals, topics
// RLS: server client

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { notifyOnExplainMore, notifyAfterResponse } from '@/lib/push/notify'
import { SIGNAL_KINDS, type SignalKind } from '@/lib/constants'

/** GET ?topic_id=… → counts per signal + which ones the caller has sent. */
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const topicId = new URL(request.url).searchParams.get('topic_id')
  if (!topicId) return NextResponse.json({ error: 'topic_id required' }, { status: 400 })

  const { data, error } = await supabase
    .from('topic_signals')
    .select('signal, user_id')
    .eq('topic_id', topicId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const counts: Record<string, number> = {}
  const mine: string[] = []
  for (const row of data ?? []) {
    counts[row.signal] = (counts[row.signal] ?? 0) + 1
    if (row.user_id === user.id) mine.push(row.signal)
  }

  return NextResponse.json({ counts, mine })
}

/** POST toggles one signal on/off. */
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { topic_id?: string; signal?: SignalKind }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { topic_id, signal } = body
  if (!topic_id || !signal) {
    return NextResponse.json({ error: 'topic_id and signal are required' }, { status: 400 })
  }
  if (!SIGNAL_KINDS.includes(signal)) {
    return NextResponse.json({ error: 'Invalid signal' }, { status: 400 })
  }

  // No cycle-phase gate on purpose: signals stay available when the board is
  // otherwise locked, which is most of the month.
  const { data: existing } = await supabase
    .from('topic_signals')
    .select('signal')
    .eq('topic_id', topic_id)
    .eq('user_id', user.id)
    .eq('signal', signal)
    .maybeSingle()

  if (existing) {
    const { error } = await supabase
      .from('topic_signals')
      .delete()
      .eq('topic_id', topic_id)
      .eq('user_id', user.id)
      .eq('signal', signal)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ active: false })
  }

  const { error } = await supabase
    .from('topic_signals')
    .insert({ topic_id, user_id: user.id, signal })

  if (error) {
    // Double-tap race - the row exists, which is the state the caller wanted.
    if (error.code === '23505') return NextResponse.json({ active: true })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // "Explain more" is a question aimed at the author, so it is the one signal
  // worth a notification - this is how a quiet member starts a discussion.
  if (signal === 'explain_more') {
    const admin = createAdminClient()
    const { data: topic } = await admin
      .from('topics')
      .select('id, user_id, title, is_anonymous')
      .eq('id', topic_id)
      .maybeSingle()

    if (topic && topic.user_id !== user.id) {
      notifyAfterResponse(
        notifyOnExplainMore({ topicId: topic.id, toUserId: topic.user_id, title: topic.title }),
        'notifyOnExplainMore',
      )
    }
  }

  return NextResponse.json({ active: true })
}
