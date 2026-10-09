// ROUTE: GET /api/topic-asks, POST /api/topic-asks, DELETE /api/topic-asks
// AUTH: authenticated
// PURPOSE: Invite a specific member into a topic. A direct ask to one person
//          outperforms an open box addressed to the whole guild.
// DB TABLES: topic_asks, topics, users
// RLS: insert with the server client. Reads and withdrawals use the service
//      role because members cannot select topic_asks.asker_id (028): who asked
//      stays private, since a ghost author asking would otherwise be unmasked.

import { createClient } from '@/lib/supabase/server'
import { getViewer } from '@/lib/supabase/viewer'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { notifyOnAsked, notifyAfterResponse } from '@/lib/push/notify'
import { ghostHandle, joinedUsername } from '@/lib/utils/anonymity'

const NOTE_MAX = 140

/** GET ?topic_id=… → who has been asked, plus who can still be asked. */
export async function GET(request: Request) {
  const { user } = await getViewer()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const topicId = new URL(request.url).searchParams.get('topic_id')
  if (!topicId) return NextResponse.json({ error: 'topic_id required' }, { status: 400 })

  const admin = createAdminClient()

  const [{ data: asks }, { data: members }] = await Promise.all([
    admin
      .from('topic_asks')
      .select('asked_id, asker_id, note, created_at, users!topic_asks_asked_id_fkey(username)')
      .eq('topic_id', topicId),
    admin.from('users').select('id, username').order('username'),
  ])

  // asker_id is not sent: the viewer only needs to know whether it was them.
  const askRows = (asks ?? []).map(a => ({
    asked_id: a.asked_id,
    note: a.note,
    created_at: a.created_at,
    username: joinedUsername(a.users) ?? 'unknown',
    // Only the asker sees a withdraw control.
    can_withdraw: a.asker_id === user.id,
  }))

  const askedIds = new Set(askRows.map(a => a.asked_id))
  const myAskCount = askRows.filter(a => a.can_withdraw).length

  return NextResponse.json({
    asks: askRows,
    // Everyone you can @mention in a comment. Mentioning is open to all;
    // only `candidates` below can also receive a direct ask. Placeholder
    // usernames (user_xxxxxxxx, before setup) are left out.
    members: (members ?? []).filter(m => m.id !== user.id && m.username && !m.username.startsWith('user_')),
    // Already-asked members are excluded so nobody gets piled on.
    candidates: (members ?? []).filter(m => m.id !== user.id && !askedIds.has(m.id)),
    remaining: Math.max(0, 2 - myAskCount),
  })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { topic_id?: string; asked_id?: string; note?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { topic_id, asked_id } = body
  const note = body.note?.trim() || null

  if (!topic_id || !asked_id) {
    return NextResponse.json({ error: 'topic_id and asked_id are required' }, { status: 400 })
  }
  if (asked_id === user.id) {
    return NextResponse.json({ error: 'You cannot ask yourself' }, { status: 400 })
  }
  if (note && note.length > NOTE_MAX) {
    return NextResponse.json({ error: `Note too long (max ${NOTE_MAX} characters)` }, { status: 400 })
  }

  const admin = createAdminClient()
  const { data: topic } = await admin
    .from('topics')
    .select('id, title, is_deleted, user_id, is_anonymous')
    .eq('id', topic_id)
    .maybeSingle()

  if (!topic || topic.is_deleted) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  // Trigger enforces max 2 per asker per topic and blocks self-asks.
  const { error } = await supabase
    .from('topic_asks')
    .insert({ topic_id, asked_id, asker_id: user.id, note })

  if (error) {
    if (error.code === '23505') {
      return NextResponse.json({ error: 'They have already been asked' }, { status: 409 })
    }
    if (error.message.includes('Ask limit reached')) {
      return NextResponse.json({ error: 'You can ask up to 2 people per topic' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  notifyAfterResponse(
    notifyOnAsked({
      topicId: topic.id,
      toUserId: asked_id,
      askerId: user.id,
      // A ghost topic's author asks as their ghost; naming them would unmask the post.
      askerLabel: topic.is_anonymous && topic.user_id === user.id ? ghostHandle(user.id, topic.id) : undefined,
      title: topic.title,
      note,
    }),
    'notifyOnAsked',
  )

  return NextResponse.json({ ok: true }, { status: 201 })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { topic_id?: string; asked_id?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { topic_id, asked_id } = body
  if (!topic_id || !asked_id) {
    return NextResponse.json({ error: 'topic_id and asked_id are required' }, { status: 400 })
  }

  // Only the asker may withdraw. Filtering on asker_id needs the service role.
  const { error } = await createAdminClient()
    .from('topic_asks')
    .delete()
    .eq('topic_id', topic_id)
    .eq('asked_id', asked_id)
    .eq('asker_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
