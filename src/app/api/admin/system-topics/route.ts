// ROUTE: POST /api/admin/system-topics
// AUTH: admin only
// PURPOSE: The admin "Suggest topics" button. Two steps, so a person sees
//          Gemini's picks before anything reaches the board or Slack:
//            { action: 'preview' }          -> 3-5 drafts, nothing written
//            { action: 'post', drafts: [] } -> post the chosen drafts as
//                                              GuildBoard, then one Slack
//                                              message and one push
// DB TABLES: cycles, topics, users
// RLS: server client for identity; admin client for writes

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { suggestSystemTopics } from '@/lib/system/suggest'
import { publishSystemTopics, sanitizeDrafts } from '@/lib/system/topics'
import { isGeminiConfigured } from '@/lib/ai/gemini'

// Fetching the news pool plus one Gemini call, with retries on rate limits.
export const maxDuration = 300

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: me } = await admin.from('users').select('role').eq('id', user.id).maybeSingle()
  if (me?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { action?: string; drafts?: unknown } = {}
  try { body = await request.json() } catch { /* empty body */ }

  const { data: cycle } = await admin
    .from('cycles')
    .select('id, label')
    .eq('status', 'open')
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!cycle) return NextResponse.json({ error: 'No open cycle to post into.' }, { status: 400 })

  if (body.action === 'preview') {
    if (!isGeminiConfigured()) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not set on the server.' }, { status: 400 })
    }
    const { data: topics } = await admin
      .from('topics').select('title').eq('cycle_id', cycle.id).eq('is_deleted', false)
    const drafts = await suggestSystemTopics({
      monthLabel: cycle.label,
      existingTitles: (topics ?? []).map(t => t.title),
    })
    if (drafts.length === 0) {
      return NextResponse.json(
        { error: 'Gemini did not return usable suggestions this time (often a rate limit). Try again in a minute.' },
        { status: 502 },
      )
    }
    return NextResponse.json({ cycle: cycle.label, drafts })
  }

  if (body.action === 'post') {
    const drafts = sanitizeDrafts(body.drafts)
    if (drafts.length === 0) return NextResponse.json({ error: 'Nothing to post.' }, { status: 400 })
    const posted = await publishSystemTopics(cycle, drafts.slice(0, 5))
    return NextResponse.json({
      posted: posted.length,
      skipped: drafts.length - posted.length,
      topics: posted,
    })
  }

  return NextResponse.json({ error: "action must be 'preview' or 'post'" }, { status: 400 })
}
