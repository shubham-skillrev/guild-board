// ROUTE: GET /api/cron/system-topics
// AUTH: shared secret via Authorization: Bearer $CRON_SECRET (NOT a user session)
// PURPOSE: Once per cycle, GuildBoard suggests a few topics nobody has brought
//          yet (recent tech and AI releases), posted to the board as its own.
// DB TABLES: cycles, topics, bytes, users
// RLS: service-role client (no user context exists here)

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rejectIfNotCron } from '@/lib/bytes/cron'
import { CURATED } from '@/lib/system/curated'
import { countSystemTopics, postSystemTopics } from '@/lib/system/topics'
import { suggestSystemTopics } from '@/lib/system/suggest'
import { notifyOnSystemTopics } from '@/lib/push/notify'

/* Runs daily, acts once: the first run that finds an open cycle with no
   system posts fills it, and every later run that cycle is a no-op. Cycles
   are opened by hand, so a fixed monthly date would miss a late opening.
   A month listed in CURATED uses those hand-checked picks; any other month
   asks the model (web search, then structuring). */

// Research with web search can take a few minutes.
export const maxDuration = 300

const SUGGESTIONS_PER_CYCLE = 3

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

  if ((await countSystemTopics(cycle.id)) > 0) {
    return NextResponse.json({ skipped: true, reason: 'already_posted' })
  }

  const key = `${cycle.year}-${String(cycle.month).padStart(2, '0')}`
  let drafts = CURATED[key]
  let source: 'curated' | 'generated' = 'curated'

  if (!drafts) {
    source = 'generated'
    const since90 = new Date(Date.now() - 90 * 86_400_000).toISOString()
    const since30 = new Date(Date.now() - 30 * 86_400_000).toISOString()
    const [{ data: topics }, { data: bytes }] = await Promise.all([
      admin.from('topics').select('title').eq('is_deleted', false).gte('created_at', since90),
      admin.from('bytes').select('source_title').gte('created_at', since30),
    ])
    drafts = await suggestSystemTopics({
      monthLabel: cycle.label,
      existingTitles: (topics ?? []).map(t => t.title),
      byteTitles: (bytes ?? []).map(b => b.source_title),
      count: SUGGESTIONS_PER_CYCLE,
    })
  }

  if (drafts.length === 0) {
    return NextResponse.json({ skipped: true, reason: 'nothing_to_suggest', source })
  }

  const posted = await postSystemTopics(cycle.id, drafts.slice(0, SUGGESTIONS_PER_CYCLE))
  if (posted.length) await notifyOnSystemTopics({ label: cycle.label, topics: posted })
  return NextResponse.json({ posted: posted.length, source, titles: posted.map(p => p.title) })
}
