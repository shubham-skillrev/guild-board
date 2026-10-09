// ROUTE: GET /api/cron/system-topics
// AUTH: shared secret via Authorization: Bearer $CRON_SECRET (NOT a user session)
// PURPOSE: Once per cycle, GuildBot suggests a few topics nobody has brought
//          yet (recent tech and AI releases), posted to the board as its own.
//          Every day, it also runs GuildBot's daily check (drought messages,
//          its own ignored topics) from src/lib/guildbot-host/reactions.ts,
//          and deletes chat history older than 30 days.
// DB TABLES: cycles, topics, bytes, users
// RLS: service-role client (no user context exists here)

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rejectIfNotCron } from '@/lib/bytes/cron'
import { CURATED } from '@/lib/system/curated'
import { countSystemTopics, publishSystemTopics } from '@/lib/system/topics'
import { suggestSystemTopics } from '@/lib/system/suggest'
import { sanitizeTheme } from '@/lib/themes'
import { runDaily } from '@/lib/guildbot-host/reactions'

/* Runs daily, acts once: the first run that finds an open cycle with no
   system posts fills it, and every later run that cycle is a no-op. Cycles
   are opened by hand, so a fixed monthly date would miss a late opening.
   It runs 30 minutes after autopilot (vercel.json), so a month autopilot
   opens gets its posts the same morning. A month listed in CURATED uses
   those hand-checked picks; any other month asks Gemini for 3 from this
   week's fetched news, the first fitting the month's theme. ?dry=1 skips both guards and returns Gemini's picks without
   posting or notifying, for checking the output. */

// Fetching the pool plus one Gemini call, with retries on rate limits.
export const maxDuration = 300

const SUGGESTIONS_PER_CYCLE = 3

export async function GET(request: Request) {
  const rejected = rejectIfNotCron(request)
  if (rejected) return rejected

  const admin = createAdminClient()
  const dry = new URL(request.url).searchParams.get('dry') === '1'

  // Chat history is kept 30 days (migration 032), open cycle or not.
  if (!dry) {
    await admin.from('guildbot_messages').delete().lt('created_at', new Date(Date.now() - 30 * 86_400_000).toISOString())
  }

  const { data: cycle } = await admin
    .from('cycles')
    .select('id, label, month, year, theme, opens_at, created_at, meeting_at')
    .eq('status', 'open')
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!cycle) return NextResponse.json({ skipped: true, reason: 'no_open_cycle' })

  const topics = await postTopics(admin, cycle, dry)
  // After posting, so a drought count on opening day includes the bot's own topics.
  const guildbot = await runDaily(cycle, { dry })
  return NextResponse.json({ ...topics, guildbot })
}

async function postTopics(
  admin: ReturnType<typeof createAdminClient>,
  cycle: { id: string; label: string; month: number; year: number; theme: unknown },
  dry: boolean,
) {
  const theme = sanitizeTheme(cycle.theme)
  if (dry) {
    const { data: topics } = await admin.from('topics').select('title').eq('cycle_id', cycle.id).eq('is_deleted', false)
    const drafts = await suggestSystemTopics({
      monthLabel: cycle.label,
      existingTitles: (topics ?? []).map(t => t.title),
      theme,
      count: SUGGESTIONS_PER_CYCLE,
    })
    return { dryRun: true, count: drafts.length, drafts }
  }

  if ((await countSystemTopics(cycle.id)) > 0) {
    return { skipped: true, reason: 'already_posted' }
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
      theme,
      count: SUGGESTIONS_PER_CYCLE,
    })
  }

  if (drafts.length === 0) {
    return { skipped: true, reason: 'nothing_to_suggest', source }
  }

  const posted = await publishSystemTopics(cycle, drafts.slice(0, SUGGESTIONS_PER_CYCLE))
  return { posted: posted.length, source, titles: posted.map(p => p.title) }
}
