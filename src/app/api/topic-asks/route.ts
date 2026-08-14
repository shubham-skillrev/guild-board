// ROUTE: GET /api/topic-asks, POST /api/topic-asks, DELETE /api/topic-asks
// AUTH: authenticated
// PURPOSE: Invite a specific member into a topic. A direct ask to one person
//          outperforms an open box addressed to the whole guild.
// DB TABLES: topic_asks, topics, users
// RLS: server client; admin client only to list guild members for the picker

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { notifyOnAsked, notifyAfterResponse } from '@/lib/push/notify'
import { joinedUsername } from '@/lib/utils/anonymity'

const NOTE_MAX = 140

/** GET ?topic_id=… → who has been asked, plus who can still be asked. */
export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
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

  const askRows = (asks ?? []).map(a => ({
    asked_id: a.asked_id,
    asker_id: a.asker_id,
    note: a.note,
    created_at: a.created_at,
    username: joinedUsername(a.users) ?? 'unknown',
    // Only the asker sees a withdraw control.
    can_withdraw: a.asker_id === user.id,
  }))

  const askedIds = new Set(askRows.map(a => a.asked_id))
  const myAskCount = askRows.filter(a => a.asker_id === user.id).length

  return NextResponse.json({
    asks: askRows,
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
    .select('id, title, is_deleted')
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
    notifyOnAsked({ topicId: topic.id, toUserId: asked_id, askerId: user.id, title: topic.title, note }),
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

  // RLS restricts deletion to the asker.
  const { error } = await supabase
    .from('topic_asks')
    .delete()
    .eq('topic_id', topic_id)
    .eq('asked_id', asked_id)
    .eq('asker_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
