// ROUTE: GET /api/cron/system-topics
// AUTH: shared secret via Authorization: Bearer $CRON_SECRET (NOT a user session)
// PURPOSE: Once per cycle, GuildBot suggests a few topics nobody has brought
//          yet (recent tech and AI releases), posted to the board as its own.
// DB TABLES: cycles, topics, bytes, users
// RLS: service-role client (no user context exists here)

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rejectIfNotCron } from '@/lib/bytes/cron'
import { CURATED } from '@/lib/system/curated'
import { countSystemTopics, publishSystemTopics } from '@/lib/system/topics'
import { suggestSystemTopics } from '@/lib/system/suggest'

/* Runs daily, acts once: the first run that finds an open cycle with no
   system posts fills it, and every later run that cycle is a no-op. Cycles
   are opened by hand, so a fixed monthly date would miss a late opening.
   A month listed in CURATED uses those hand-checked picks; any other month
   asks Gemini to pick 3-5 from this week's fetched news (1-2 AI, 2-3
   engineering). ?dry=1 skips both guards and returns Gemini's picks without
   posting or notifying, for checking the output. */

// Fetching the pool plus one Gemini call, with retries on rate limits.
export const maxDuration = 300

const SUGGESTIONS_PER_CYCLE = 5

export async function GET(request: Request) {
  const rejected = rejectIfNotCron(request)
  if (rejected) return rejected

  const admin = createAdminClient()
  const { data: cycle } = await admin
    .from('cycles')
    .select('id, label, month, year')
    .eq('status', 'open')
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!cycle) return NextResponse.json({ skipped: true, reason: 'no_open_cycle' })

  const dry = new URL(request.url).searchParams.get('dry') === '1'
  if (dry) {
    const { data: topics } = await admin.from('topics').select('title').eq('cycle_id', cycle.id).eq('is_deleted', false)
    const drafts = await suggestSystemTopics({
      monthLabel: cycle.label,
      existingTitles: (topics ?? []).map(t => t.title),
      count: SUGGESTIONS_PER_CYCLE,
    })
    return NextResponse.json({ dryRun: true, count: drafts.length, drafts })
  }

  if ((await countSystemTopics(cycle.id)) > 0) {
    return NextResponse.json({ skipped: true, reason: 'already_posted' })
  }

  const key = `${cycle.year}-${String(cycle.month).padStart(2, '0')}`
  let drafts = CURATED[key]
  let source: 'curated' | 'generated' = 'curated'

  if (!drafts) {
    source = 'generated'
    const since90 = new Date(Date.now() - 90 * 86_400_000).toISOString()
    const { data: topics } = await admin
      .from('topics').select('title').eq('is_deleted', false).gte('created_at', since90)
    drafts = await suggestSystemTopics({
      monthLabel: cycle.label,
      existingTitles: (topics ?? []).map(t => t.title),
      count: SUGGESTIONS_PER_CYCLE,
    })
  }

  if (drafts.length === 0) {
    return NextResponse.json({ skipped: true, reason: 'nothing_to_suggest', source })
  }

  const posted = await publishSystemTopics(cycle, drafts.slice(0, SUGGESTIONS_PER_CYCLE))
  return NextResponse.json({ posted: posted.length, source, titles: posted.map(p => p.title) })
}
