// ROUTE: GET, POST /api/admin/announcements
// AUTH: admin only
// PURPOSE: The admin announcement composer.
//            GET                              -> the last 10 sent
//            POST { action: 'draft', brief }  -> a Gemini draft, nothing sent
//            POST { action: 'send', title, body, slack_text, url?, channels }
//                                             -> Slack and/or push, then a
//                                                history row with the result
// DB TABLES: announcements, users, push_subscriptions
// RLS: server client for identity; admin client for reads and writes

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isGeminiConfigured } from '@/lib/ai/gemini'
import { draftAnnouncement } from '@/lib/announce/draft'
import { ANNOUNCE_LIMITS, type AnnouncementChannel } from '@/lib/announce'
import { notifyAnnouncement } from '@/lib/push/notify'

// A Gemini draft, with retries on rate limits.
export const maxDuration = 120

/** The same message again inside this window is refused as a double press. */
const REPEAT_WINDOW_MS = 10 * 60 * 1000
const CHANNELS = new Set<AnnouncementChannel>(['slack', 'push'])

async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  const admin = createAdminClient()
  const { data: me } = await admin.from('users').select('role').eq('id', user.id).maybeSingle()
  if (me?.role !== 'admin') return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { admin, userId: user.id }
}

export async function GET() {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const { data } = await auth.admin
    .from('announcements')
    .select('id, title, body, slack_text, url, channels, slack_ok, push_sent, sent_at')
    .order('sent_at', { ascending: false })
    .limit(10)
  return NextResponse.json({ announcements: data ?? [] })
}

export async function POST(request: Request) {
  const auth = await requireAdmin()
  if ('error' in auth) return auth.error
  const { admin, userId } = auth

  let body: Record<string, unknown> = {}
  try { body = await request.json() } catch { /* empty body */ }

  if (body.action === 'draft') {
    const brief = typeof body.brief === 'string' ? body.brief.trim() : ''
    if (!brief) return NextResponse.json({ error: 'Say what to announce first.' }, { status: 400 })
    if (!isGeminiConfigured()) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not set on the server.' }, { status: 400 })
    }
    const draft = await draftAnnouncement({ brief })
    if (!draft) {
      return NextResponse.json(
        { error: 'Gemini did not return a usable draft (often a rate limit). Try again in a minute.' },
        { status: 502 },
      )
    }
    return NextResponse.json({ draft })
  }

  if (body.action === 'send') {
    const text = (v: unknown, max: number) => (typeof v === 'string' ? v.trim() : '').slice(0, max)
    const title = text(body.title, ANNOUNCE_LIMITS.title)
    const message = text(body.body, ANNOUNCE_LIMITS.body)
    const slackText = text(body.slack_text, ANNOUNCE_LIMITS.slack)
    const url = text(body.url, ANNOUNCE_LIMITS.url) || null
    const channels = (Array.isArray(body.channels) ? body.channels : [])
      .filter((c): c is AnnouncementChannel => CHANNELS.has(c as AnnouncementChannel))

    if (!channels.length) return NextResponse.json({ error: 'Pick Slack, push, or both.' }, { status: 400 })
    if (channels.includes('push') && (!title || !message)) {
      return NextResponse.json({ error: 'A push needs a title and a body.' }, { status: 400 })
    }
    if (channels.includes('slack') && !slackText) {
      return NextResponse.json({ error: 'The Slack message is empty.' }, { status: 400 })
    }
    if (url && !/^(https:\/\/|\/)/.test(url)) {
      return NextResponse.json({ error: 'The link must start with https:// or /.' }, { status: 400 })
    }

    const since = new Date(Date.now() - REPEAT_WINDOW_MS).toISOString()
    const { data: recent } = await admin
      .from('announcements')
      .select('id')
      .eq('title', title)
      .eq('body', message)
      .eq('slack_text', slackText)
      .gte('sent_at', since)
      .limit(1)
    if (recent?.length) {
      return NextResponse.json({ error: 'That exact announcement went out in the last 10 minutes.' }, { status: 409 })
    }

    // The row first, so its id can tag the push (one notification per
    // announcement, however many devices).
    const { data: row, error } = await admin
      .from('announcements')
      .insert({ title, body: message, slack_text: slackText, url, channels, sent_by: userId })
      .select('id')
      .single()
    if (error || !row) return NextResponse.json({ error: 'Could not save the announcement.' }, { status: 500 })

    const result = await notifyAnnouncement({ id: row.id, title, body: message, slackText, url, channels })
    await admin
      .from('announcements')
      .update({ slack_ok: result.slackOk, push_sent: result.pushSent })
      .eq('id', row.id)

    return NextResponse.json({ id: row.id, ...result })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
