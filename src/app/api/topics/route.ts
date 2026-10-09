// ROUTE: GET /api/topics, POST /api/topics
// AUTH: authenticated
// PURPOSE: GET all active topics for current cycle (with user vote status); POST submit new topic
// DB TABLES: topics, cycles, votes, users
// RLS: server client for the viewer's own rows; topics are read with the
//      service role because members cannot select topics.user_id (028) and the
//      serializer needs it to hide ghost authors.

import { createClient } from '@/lib/supabase/server'
import { getViewer } from '@/lib/supabase/viewer'
import { createAdminClient } from '@/lib/supabase/admin'
import { broadcastTopicChange } from '@/lib/realtime/broadcast'
import { NextResponse } from 'next/server'
import { guildbotAfter, onTopicPosted } from '@/lib/guildbot-host/reactions'

// GuildBot may write a comment after the response: a model call and a
// review, about 20s each, plus up to 45s of retry on a busy model.
export const maxDuration = 120
import { botSays } from '@/lib/guildbot-host/voice'
import { notifyOnNewTopic, notifyAfterResponse } from '@/lib/push/notify'
import { serializeTopic, withoutAuthor, MEMBER_TOPIC_FIELDS } from '@/lib/utils/anonymity'
import { isInteractionLocked, isVotingAllowed } from '@/lib/utils/cycle'
import { createPoll, loadPolls, parsePollInput, replacePoll } from '@/lib/polls'
import { ALL_CATEGORIES } from '@/lib/constants'
import type { Cycle } from '@/types'
import type { CategoryTag, PollInput } from '@/types'

export async function GET(request: Request) {
  const { supabase, user } = await getViewer()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = new URL(request.url)
  const queryCycleId = url.searchParams.get('cycle_id')

  let cycleId: string | null = queryCycleId

  if (!cycleId) {
    // Get current active cycle
    const { data: cycle } = await supabase
      .from('cycles')
      .select('id')
      .eq('status', 'open')
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(1)
      .single()

    cycleId = cycle?.id ?? null
  }

  if (!cycleId) {
    return NextResponse.json([])
  }

  // Service role: RLS would hide deleted rows, so that filter stays explicit.
  const { data: topics, error } = await createAdminClient()
    .from('topics')
    .select('id,cycle_id,user_id,is_anonymous,title,description,category,vote_count,contrib_count,comment_count,score,is_selected,is_deleted,status,outcome_tag,outcome_note,override_reason,created_at,updated_at,users!topics_user_id_fkey(username)')
    .eq('cycle_id', cycleId)
    .eq('is_deleted', false)
    .order('score', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const topicIds = (topics ?? []).map(t => t.id)

  const admin = createAdminClient()
  const { data: cycleRow } = await admin.from('cycles').select('status, meeting_at').eq('id', cycleId).maybeSingle()
  const polls = await loadPolls(admin, topicIds, user.id, isVotingAllowed(cycleRow as Cycle | null))

  // Get current user's votes for this cycle, plus signals
  // for these topics. Signals ship inline so the board does not fire one
  // request per card.
  const [{ data: userVotes }, { data: signals }] = await Promise.all([
    supabase.from('votes').select('topic_id').eq('user_id', user.id).eq('cycle_id', cycleId),
    topicIds.length
      ? supabase.from('topic_signals').select('topic_id, signal, user_id').in('topic_id', topicIds)
      : Promise.resolve({ data: [] as { topic_id: string; signal: string; user_id: string }[] }),
  ])

  const votedTopicIds = new Set((userVotes ?? []).map(v => v.topic_id))

  const signalCounts = new Map<string, Record<string, number>>()
  const mySignals = new Map<string, string[]>()
  for (const row of signals ?? []) {
    const counts = signalCounts.get(row.topic_id) ?? {}
    counts[row.signal] = (counts[row.signal] ?? 0) + 1
    signalCounts.set(row.topic_id, counts)
    if (row.user_id === user.id) {
      mySignals.set(row.topic_id, [...(mySignals.get(row.topic_id) ?? []), row.signal])
    }
  }

  const result = (topics ?? []).map((topic: any) => ({
    ...serializeTopic(topic, user.id),
    user_has_voted: votedTopicIds.has(topic.id),
    poll: polls.get(topic.id) ?? null,
    signal_counts: signalCounts.get(topic.id) ?? {},
    my_signals: mySignals.get(topic.id) ?? [],
  }))

  return NextResponse.json(result)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { title?: string; description?: string; category?: CategoryTag; is_anonymous?: boolean; poll?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { title, description, category, is_anonymous } = body

  if (!title?.trim() || !description?.trim() || !category) {
    return NextResponse.json({ error: 'title, description, and category are required' }, { status: 400 })
  }
  if (!ALL_CATEGORIES.includes(category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }
  if (title.length > 80) return NextResponse.json({ error: 'Title too long' }, { status: 400 })
  if (description.length > 1000) return NextResponse.json({ error: 'Description too long (max 1000 characters)' }, { status: 400 })

  // Checked before the topic exists, so a bad poll never leaves a half-made post.
  let poll: PollInput | null = null
  if (body.poll != null) {
    const parsed = parsePollInput(body.poll)
    if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
    poll = parsed.poll
  }

  // Get current open cycle - most recent by year/month
  const { data: cycle } = await supabase
    .from('cycles')
    .select('id, status, meeting_at')
    .eq('status', 'open')
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(1)
    .single()

  if (!cycle) {
    return NextResponse.json({ error: 'No open cycle' }, { status: 400 })
  }
  // Same rule the board applies: writing closes when the meeting starts.
  if (isInteractionLocked(cycle as Cycle)) {
    return NextResponse.json({ error: 'The meeting has started. Submissions reopen next cycle.' }, { status: 409 })
  }

  // DB trigger enforces 3 topics per user per cycle - insert will fail if limit exceeded
  const { data, error } = await supabase
    .from('topics')
    .insert({
      cycle_id: cycle.id,
      user_id: user.id,
      title,
      description,
      category,
      is_anonymous: is_anonymous === true,
    })
    // Not user_id: members cannot read it back (028), and the client does not need it.
    .select(MEMBER_TOPIC_FIELDS)
    .single()

  if (error) {
    if (error.message.includes('Topic limit reached')) {
      return NextResponse.json({
        error: botSays('ui.quota_out', cycle.id, 'ui') ?? "You've shared three things this cycle. That's the limit, so everyone gets a turn.",
      }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (poll) {
    const pollErr = await createPoll(createAdminClient(), data.id, poll)
    if (pollErr) {
      // Undo the post rather than publish it without the poll it was written around.
      await createAdminClient().from('topics').update({ is_deleted: true }).eq('id', data.id)
      return NextResponse.json({ error: 'Could not save the poll. Nothing was posted, try again.' }, { status: 500 })
    }
  }

  notifyAfterResponse(notifyOnNewTopic({ topicId: data.id, actorId: user.id }), "notifyOnNewTopic")
  broadcastTopicChange(data.id, ['topics'])
  guildbotAfter(() => onTopicPosted(data.id), 'onTopicPosted')

  return NextResponse.json({ ...data, is_owner: true }, { status: 201 })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { id?: string; title?: string; description?: string; category?: CategoryTag; poll?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { id, title, description, category } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const admin = createAdminClient()

  const { data: existing, error: existingErr } = await admin
    .from('topics')
    .select('user_id, cycle_id, is_deleted')
    .eq('id', id)
    .maybeSingle()

  if (existingErr) return NextResponse.json({ error: existingErr.message }, { status: 500 })
  if (!existing || existing.is_deleted) return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  if (existing.user_id !== user.id) return NextResponse.json({ error: 'Not your topic' }, { status: 403 })

  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (title?.trim()) {
    if (title.length > 80) return NextResponse.json({ error: 'Title too long' }, { status: 400 })
    updates.title = title.trim()
  }
  if (description?.trim()) {
    if (description.length > 1000) return NextResponse.json({ error: 'Description too long (max 1000 characters)' }, { status: 400 })
    updates.description = description.trim()
  }
  if (category) updates.category = category

  // `poll` absent: leave it. null: remove it. Object: replace it. Either change
  // is refused once someone has voted (see replacePoll).
  if (body.poll !== undefined) {
    let poll: PollInput | null = null
    if (body.poll !== null) {
      const parsed = parsePollInput(body.poll)
      if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 })
      poll = parsed.poll
    }
    const pollErr = await replacePoll(admin, id, poll)
    if (pollErr) return NextResponse.json({ error: pollErr }, { status: 409 })
  }

  const { data, error } = await admin
    .from('topics')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  broadcastTopicChange(id, ['topics', 'poll'])
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

  const { data: existing, error: existingErr } = await admin
    .from('topics')
    .select('user_id, is_deleted')
    .eq('id', id)
    .maybeSingle()

  if (existingErr) return NextResponse.json({ error: existingErr.message }, { status: 500 })
  if (!existing || existing.is_deleted) return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  // Admins may hide any topic, ghost ones included. Hiding never reveals who
  // wrote it: this route answers with a bare success either way.
  if (existing.user_id !== user.id && !(await isAdmin(admin, user.id))) {
    return NextResponse.json({ error: 'Not your topic' }, { status: 403 })
  }

  const { data: updated, error } = await admin
    .from('topics')
    .update({ is_deleted: true, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!updated || updated.length === 0) {
    return NextResponse.json({ error: 'Delete did not affect any row' }, { status: 500 })
  }

  /* Release the banked idea this topic was promoted from.
     `idea_bank.promoted_topic_id` is declared ON DELETE SET NULL, but topics
     are soft-deleted, so the row never goes away and the constraint never
     fires. That left a dead end: the bank refused to delete the idea because
     it was "already on the board", and the board no longer had it. The idea
     could be neither re-pitched nor removed, permanently.
     Clearing it here returns the idea to the bank as unpromoted, which is the
     honest state once the topic is gone. */
  const { error: releaseErr } = await admin
    .from('idea_bank')
    .update({ promoted_topic_id: null, promoted_by: null, promoted_at: null })
    .eq('promoted_topic_id', id)

  // Non-fatal: the topic is already gone, and a stuck flag is recoverable.
  if (releaseErr) console.warn('topics: could not release banked idea', releaseErr)

  broadcastTopicChange(id, ['topics'])
  return NextResponse.json({ success: true })
}

async function isAdmin(admin: ReturnType<typeof createAdminClient>, userId: string): Promise<boolean> {
  const { data } = await admin.from('users').select('role').eq('id', userId).maybeSingle()
  return data?.role === 'admin'
}
