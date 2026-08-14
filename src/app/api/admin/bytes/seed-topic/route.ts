// ROUTE: POST /api/admin/bytes/seed-topic
// AUTH: admin only
// PURPOSE: Promote a byte the guild showed interest in onto the live board.
//          This is what stops the digest being a side pond - interest taps
//          rank the bytes, and the admin turns the top one into a topic.
// DB TABLES: bytes, topics, cycles, users
// RLS: admin client for writes
//
// NOTE: the seeded topic sets is_carry_forward = TRUE so it does not consume
// the admin's own 1-topic-per-cycle quota. That flag is the exemption
// migration 006 established for exactly this case - check_topic_limit() is
// left untouched.

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { notifyOnNewTopic, notifyAfterResponse } from '@/lib/push/notify'
import type { CategoryTag } from '@/types'

/** Fallback link text when a row predates the source_name column. */
const SOURCE_LABELS: Record<string, string> = {
  hn: 'Hacker News',
  devto: 'dev.to',
  github: 'GitHub',
  blog: 'Engineering blog',
  news: 'Article',
  video: 'Watch',
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: me } = await admin.from('users').select('role').eq('id', user.id).maybeSingle()
  if (me?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { byte_id?: string; category?: CategoryTag }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { byte_id } = body
  if (!byte_id) return NextResponse.json({ error: 'byte_id required' }, { status: 400 })

  const { data: byte } = await admin
    .from('bytes')
    .select('id, source, source_title, source_name, url, summary, editor_note, seeded_topic_id')
    .eq('id', byte_id)
    .maybeSingle()

  if (!byte) return NextResponse.json({ error: 'Byte not found' }, { status: 404 })
  if (byte.seeded_topic_id) {
    return NextResponse.json({ error: 'This byte is already on the board' }, { status: 409 })
  }

  const { data: cycle } = await admin
    .from('cycles')
    .select('id, meeting_at')
    .eq('status', 'open')
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!cycle) return NextResponse.json({ error: 'No open cycle' }, { status: 400 })

  const description = [
    byte.summary ?? '',
    byte.editor_note ? `\n\n> ${byte.editor_note}` : '',
    // Link text is the publisher when we have it: "Cloudflare" tells a reader
    // more about what they are about to open than "Engineering blog" does.
    `\n\n[${byte.source_name || SOURCE_LABELS[byte.source] || byte.source}](${byte.url}) · from this cycle's Bytes.`,
  ].join('').trim().slice(0, 1000)

  const { data: topic, error: topicErr } = await admin
    .from('topics')
    .insert({
      cycle_id: cycle.id,
      user_id: user.id,
      title: byte.source_title.slice(0, 80),
      description,
      category: body.category ?? 'discussion',
      // Exempts this from the 1-topic-per-cycle trigger (migration 006).
      is_carry_forward: true,
    })
    .select()
    .single()

  if (topicErr) return NextResponse.json({ error: topicErr.message }, { status: 500 })

  const { error: linkErr } = await admin
    .from('bytes')
    .update({ seeded_topic_id: topic.id })
    .eq('id', byte.id)
    .is('seeded_topic_id', null)

  if (linkErr) console.warn('byte seed link failed', linkErr)

  notifyAfterResponse(
    notifyOnNewTopic({ topicId: topic.id, actorId: user.id }),
    'notifyOnNewTopic',
  )

  return NextResponse.json(topic, { status: 201 })
}
