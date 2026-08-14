import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchCandidates } from '@/lib/bytes/sources'
import { selectMix } from '@/lib/bytes/domains'
import { summarizeCandidates } from '@/lib/bytes/summarize'

/**
 * Build one digest. Shared by the weekly cron and the admin's manual button so
 * the two paths cannot drift apart.
 */

export interface GenerateOptions {
  /** Lookback window in days. */
  days?: number
  /** How many stories to keep. */
  limit?: number
  kind?: 'weekly' | 'monthly'
  /** Monday of the covered week. Enforces one automatic digest per period. */
  periodStart?: string | null
  label?: string
  cycleId?: string | null
  createdBy: string
}

/** How many of each medium landed, for the notification copy and the admin UI. */
export interface MediumCounts {
  blog: number
  news: number
  video: number
  hn: number
}

export type GenerateResult =
  | {
      ok: true
      digestId: string
      label: string
      count: number
      summarized: number
      mix: MediumCounts
    }
  | { ok: false; reason: 'no_candidates' | 'all_seen' | 'duplicate_period' | 'db_error'; message: string }

/** Monday 00:00 UTC of the week containing `date`. */
export function weekStart(date = new Date()): string {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const dayOffset = (d.getUTCDay() + 6) % 7 // Monday = 0
  d.setUTCDate(d.getUTCDate() - dayOffset)
  return d.toISOString().slice(0, 10)
}

export function weekLabel(periodStart: string): string {
  const d = new Date(`${periodStart}T00:00:00Z`)
  return `Week of ${d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })}`
}

export async function generateDigest(opts: GenerateOptions): Promise<GenerateResult> {
  const {
    days = 8,
    limit = 10,
    kind = 'weekly',
    periodStart = null,
    cycleId = null,
    createdBy,
  } = opts

  const admin = createAdminClient()

  // One automatic digest per period. Checked up front so a duplicate cron
  // firing is a cheap no-op rather than a wasted fetch and summarization pass.
  if (periodStart) {
    const { data: existing } = await admin
      .from('byte_digests')
      .select('id')
      .eq('kind', kind)
      .eq('period_start', periodStart)
      .maybeSingle()

    if (existing) {
      return {
        ok: false,
        reason: 'duplicate_period',
        message: `A ${kind} digest for ${periodStart} already exists.`,
      }
    }
  }

  /* Fetch a pool several times the target, not the target itself.
     Selection used to happen before the already-seen filter, so a refetch
     took the top 10, discarded the 7 that had already been published, and
     produced a digest of 3. The stories most likely to rank are exactly the
     ones already in the table, so the shortfall grew the more the feed was
     refetched. Order is now: wide pool, drop seen, then select for breadth. */
  const pool = await fetchCandidates(days, limit * 6)
  if (!pool.length) {
    return { ok: false, reason: 'no_candidates', message: 'No stories came back from any feed.' }
  }

  // Skip anything already published, so a long-running story does not reappear
  // week after week.
  const { data: seen } = await admin
    .from('bytes')
    .select('source, source_id')
    .in('source_id', pool.map(c => c.source_id))

  const seenKeys = new Set((seen ?? []).map(s => `${s.source}:${s.source_id}`))
  const unseen = pool.filter(c => !seenKeys.has(`${c.source}:${c.source_id}`))

  if (!unseen.length) {
    return {
      ok: false,
      reason: 'all_seen',
      message: 'Everything found has already appeared in a previous digest.',
    }
  }

  // Selection runs here, on what is actually available to publish. Mixed by
  // medium first (articles, news, video, HN) and by topic within each.
  const fresh = selectMix(unseen, limit)

  // Absent an API key this returns an empty map and the digest still lands,
  // just with blank summaries to fill in by hand.
  const summaries = await summarizeCandidates(fresh)

  const label = opts.label?.trim() || (periodStart ? weekLabel(periodStart) : monthLabel())

  const { data: digest, error: digestErr } = await admin
    .from('byte_digests')
    .insert({
      cycle_id: cycleId,
      label,
      kind,
      period_start: periodStart,
      // Digests go live on creation. The content is grounded (titles and links
      // are verbatim from the feeds) and summaries are labeled as AI-drafted,
      // so there is nothing for a review step to protect against. The admin
      // curates in place afterwards instead: edit, annotate, or delete.
      status: 'published',
      published_at: new Date().toISOString(),
      created_by: createdBy,
    })
    .select()
    .single()

  if (digestErr) {
    // Unique index on (kind, period_start) means a concurrent run won the race.
    if (digestErr.code === '23505') {
      return { ok: false, reason: 'duplicate_period', message: 'Digest for this period already exists.' }
    }
    return { ok: false, reason: 'db_error', message: digestErr.message }
  }

  // source_title, source_name, url and thumbnail_url are written straight from
  // the feed response. Nothing the model returned can reach those columns.
  const rows = fresh.map((c, i) => {
    const s = summaries.get(c.source_id)
    return {
      digest_id: digest.id,
      source: c.source,
      source_id: c.source_id,
      source_title: c.title,
      source_name: c.source_name,
      url: c.url,
      thumbnail_url: c.thumbnail ?? null,
      source_points: c.points,
      domain: c.domain,
      summary: s?.summary ?? null,
      tags: s?.tags ?? null,
      position: i,
    }
  })

  const { error: bytesErr } = await admin.from('bytes').insert(rows)
  if (bytesErr) {
    await admin.from('byte_digests').delete().eq('id', digest.id)
    return { ok: false, reason: 'db_error', message: bytesErr.message }
  }

  const mix: MediumCounts = { blog: 0, news: 0, video: 0, hn: 0 }
  for (const c of fresh) mix[c.source] += 1

  return {
    ok: true,
    digestId: digest.id,
    label,
    count: rows.length,
    summarized: summaries.size,
    mix,
  }
}

function monthLabel(): string {
  const now = new Date()
  return `${now.toLocaleString('en-US', { month: 'long' })} ${now.getFullYear()} Bytes`
}
