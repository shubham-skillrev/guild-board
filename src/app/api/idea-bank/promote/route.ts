// ROUTE: POST /api/idea-bank/promote
// AUTH: authenticated
// PURPOSE: Move a banked idea onto the live voting board as a topic.
//          Banking is unlimited; promotion is where the 1-topic-per-cycle
//          cap applies — check_topic_limit() is left intact on purpose.
// DB TABLES: idea_bank, topics, cycles, users
// RLS: server client for identity + insert; admin client only to credit the
//      originator of someone else's open idea (their row is not caller-visible)

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { notifyOnNewTopic, notifyOnIdeaTaken, notifyAfterResponse } from '@/lib/push/notify'
import type { CategoryTag } from '@/types'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { id?: string; description?: string; category?: CategoryTag }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { id } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  // Readable via RLS if it is the caller's own idea, or open to the guild.
  const { data: idea, error: ideaErr } = await supabase
    .from('idea_bank')
    .select('id, user_id, title, note, category, is_open, is_anonymous, promoted_topic_id')
    .eq('id', id)
    .maybeSingle()

  if (ideaErr) return NextResponse.json({ error: ideaErr.message }, { status: 500 })
  if (!idea) return NextResponse.json({ error: 'Idea not found' }, { status: 404 })

  const isOwner = idea.user_id === user.id
  if (!isOwner && !idea.is_open) {
    return NextResponse.json({ error: 'Not your idea' }, { status: 403 })
  }
  if (idea.promoted_topic_id) {
    return NextResponse.json({ error: 'This idea is already on the board' }, { status: 409 })
  }

  const { data: cycle } = await supabase
    .from('cycles')
    .select('id, status, meeting_at')
    .eq('status', 'open')
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!cycle) {
    return NextResponse.json(
      { error: 'No open cycle right now — your idea stays banked until the next one opens.' },
      { status: 400 },
    )
  }
  if (cycle.meeting_at && new Date() >= new Date(cycle.meeting_at)) {
    return NextResponse.json(
      { error: 'This cycle has started — your idea stays banked for the next one.' },
      { status: 400 },
    )
  }

  const description =
    body.description?.trim() ||
    idea.note?.trim() ||
    // Topics require a description; a bare title is a valid bank entry.
    `${idea.title}\n\n_Promoted from the idea bank._`

  // Someone taking an open idea pitches it under their own name, but the
  // originator is credited in the body — both showed up.
  const creditNote =
    !isOwner && !idea.is_anonymous
      ? await (async () => {
          const admin = createAdminClient()
          const { data: author } = await admin
            .from('users').select('username').eq('id', idea.user_id).maybeSingle()
          return author?.username ? `\n\n_Idea by @${author.username}, picked up from the bank._` : ''
        })()
      : !isOwner
        ? '\n\n_Picked up from the idea bank._'
        : ''

  // check_topic_limit() enforces 1 per cycle here — this is deliberate.
  const { data: topic, error: topicErr } = await supabase
    .from('topics')
    .insert({
      cycle_id: cycle.id,
      user_id: user.id,
      title: idea.title,
      description: `${description}${creditNote}`.slice(0, 1000),
      category: body.category ?? idea.category ?? 'discussion',
      // Only the original author can carry anonymity across; a member taking
      // someone else's open idea is pitching it themselves.
      is_anonymous: isOwner && idea.is_anonymous,
    })
    .select()
    .single()

  if (topicErr) {
    if (topicErr.message.includes('Topic limit reached')) {
      return NextResponse.json(
        { error: 'You already have a topic on the board this cycle. Your idea stays banked.' },
        { status: 409 },
      )
    }
    return NextResponse.json({ error: topicErr.message }, { status: 500 })
  }

  // Link the bank row for provenance. Admin client because promoting another
  // member's open idea means updating a row the caller cannot write via RLS.
  const admin = createAdminClient()
  const { error: linkErr } = await admin
    .from('idea_bank')
    .update({
      promoted_topic_id: topic.id,
      promoted_by: user.id,
      promoted_at: new Date().toISOString(),
    })
    .eq('id', idea.id)
    .is('promoted_topic_id', null)   // lost race → no rows, topic already exists

  if (linkErr) {
    // The topic is live and is the thing that matters; provenance is not
    // worth failing the request over.
    console.warn('idea_bank promotion link failed', linkErr)
  }

  notifyAfterResponse(
    notifyOnNewTopic({ topicId: topic.id, actorId: user.id }),
    'notifyOnNewTopic',
  )

  // Tell the originator their idea got picked up — the payoff for banking
  // something you were never going to pitch yourself.
  if (!isOwner) {
    notifyAfterResponse(
      notifyOnIdeaTaken({ toUserId: idea.user_id, actorId: user.id, title: idea.title, topicId: topic.id }),
      'notifyOnIdeaTaken',
    )
  }

  return NextResponse.json(topic, { status: 201 })
}
