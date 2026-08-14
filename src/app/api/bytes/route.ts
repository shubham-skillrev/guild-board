// ROUTE: GET /api/bytes
// AUTH: authenticated
// PURPOSE: The current week's digest, plus a Top section drawn from recent
//          weeks. Drafts are excluded by RLS, not by this query.
// DB TABLES: byte_digests, bytes, byte_interests
// RLS: server client (published-only policies do the filtering)

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

/* How many past digests the Top section draws from. Counted in digests, not
   days, so it has to track the cadence: at one digest every other morning, 7
   covers roughly a fortnight - long enough that a story which gained traction
   last week can still lead, short enough that "Top right now" is not showing
   something from a month ago. It was 5 on a weekly cadence. */
const TOP_WINDOW = 7
const TOP_COUNT = 3

interface RankableByte {
  id: string
  interest_count: number
  source_points: number | null
  source: string
  domain: string | null
}

/**
 * Rank for the Top section.
 *
 * Combines what the guild engaged with (interest taps) and how the story did
 * on its own platform (feed score). Taps are weighted far higher because they
 * are this guild's own signal, while the feed score is normalized per source
 * and mainly breaks ties in a fresh week where nothing has been tapped yet.
 */
const FEED_REFERENCE: Record<string, number> = {
  hn: 2000,
  video: 400_000, // YouTube views
  lobsters: 80,
  devto: 400,
  github: 8000, // retired source, still present in old rows
}

function topScore(b: RankableByte): number {
  const reference = FEED_REFERENCE[b.source] ?? 1000
  const points = b.source_points ?? 0
  const feed = points > 0 ? Math.log10(points + 1) / Math.log10(reference + 1) : 0
  return b.interest_count * 10 + Math.min(1, feed) * 4
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Recent published digests, newest first. RLS hides drafts.
  const { data: digests } = await supabase
    .from('byte_digests')
    .select('id, label, kind, period_start, published_at')
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(TOP_WINDOW)

  if (!digests?.length) {
    return NextResponse.json({ digest: null, top: [], bytes: [], archive: [] })
  }

  const current = digests[0]

  const [{ data: rows }, { data: mine }] = await Promise.all([
    supabase
      .from('bytes')
      .select(
        'id, digest_id, source, source_title, source_name, url, thumbnail_url, source_points, summary, tags, editor_note, domain, interest_count, seeded_topic_id, position',
      )
      .in('digest_id', digests.map(d => d.id)),
    supabase.from('byte_interests').select('byte_id').eq('user_id', user.id),
  ])

  const mineSet = new Set((mine ?? []).map(i => i.byte_id))
  const all = (rows ?? []).map(b => ({ ...b, user_interested: mineSet.has(b.id) }))

  // This week's stories, in the order the generator chose.
  const currentBytes = all
    .filter(b => b.digest_id === current.id)
    .sort((a, b) => a.position - b.position)

  // Top draws from the whole window so a story that gained traction last week
  // can still lead. Nothing appears in both sections.
  const topIds = new Set(
    [...all]
      .sort((a, b) => topScore(b) - topScore(a))
      .filter(b => topScore(b) > 0)
      .slice(0, TOP_COUNT)
      .map(b => b.id),
  )

  const labelById = new Map(digests.map(d => [d.id, d.label]))

  return NextResponse.json({
    digest: current,
    top: all
      .filter(b => topIds.has(b.id))
      .sort((a, b) => topScore(b) - topScore(a))
      .map(b => ({ ...b, digest_label: labelById.get(b.digest_id) ?? null })),
    bytes: currentBytes.filter(b => !topIds.has(b.id)),
    archive: digests.slice(1).map(d => ({ id: d.id, label: d.label })),
  })
}
