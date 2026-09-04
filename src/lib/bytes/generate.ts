import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { fetchCandidates } from '@/lib/bytes/sources'
import { selectMix } from '@/lib/bytes/domains'
import { summarizeCandidates } from '@/lib/bytes/summarize'

/**
 * Build one digest. Shared by the scheduled cron and the admin's manual button
 * so the two paths cannot drift apart.
 */

export type DigestKind = 'daily' | 'weekly' | 'monthly'

export interface GenerateOptions {
  /** Lookback window in days. */
  days?: number
  /** How many stories to keep. */
  limit?: number
  kind?: DigestKind
  /** The date the digest covers. Enforces one automatic digest per period. */
  periodStart?: string | null
  /**
   * Include stories that already ran in an earlier digest.
   *
   * Off for the every-other-day drop, which exists to show you what is new.
   * On for the monthly look-back, which exists to show you what mattered - and
   * by the end of a month every item worth collecting has already appeared in
   * some daily drop, so filtering them out would leave the monthly digest with
   * whatever nobody picked. When on, an item the guild actually upvoted first
   * time round is boosted, so "top of the month" means the guild's top and not
   * just the feed's.
   */
  allowSeen?: boolean
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

/** The UTC date itself, which is the period a daily digest covers. */
export function dayStart(date = new Date()): string {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  )
    .toISOString()
    .slice(0, 10)
}

export function dayLabel(periodStart: string): string {
  const d = new Date(`${periodStart}T00:00:00Z`)
  return d.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

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

/** The 1st of the month, 00:00 UTC. The period a monthly digest covers. */
export function monthStart(date = new Date()): string {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
    .toISOString()
    .slice(0, 10)
}

/**
 * "Top of August". Deliberately not "August 2026 Bytes", which is what the
 * admin's ad-hoc button produces: the monthly job is a look back over the
 * month's strongest items, and the label has to say so or the two are
 * indistinguishable in the archive list.
 */
export function monthPeriodLabel(periodStart: string): string {
  const d = new Date(`${periodStart}T00:00:00Z`)
  return `Top of ${d.toLocaleDateString('en-US', { month: 'long', timeZone: 'UTC' })}`
}

export async function generateDigest(opts: GenerateOptions): Promise<GenerateResult> {
  const {
    days = 8,
    limit = 10,
    kind = 'weekly',
    periodStart = null,
    cycleId = null,
    allowSeen = false,
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

  /* What has run before, and how the guild reacted to it.
     Chunked because a 31-day monthly window returns several hundred
     candidates, and PostgREST takes its `in` list in the query string - one
     request with every source_id in it is a URL long enough for a proxy to
     reject, which would come back as a silent empty result and quietly turn
     the seen-filter off. */
  const priorByKey = new Map<string, number>()
  for (let i = 0; i < pool.length; i += 100) {
    const { data } = await admin
      .from('bytes')
      .select('source, source_id, interest_count')
      .in('source_id', pool.slice(i, i + 100).map(c => c.source_id))

    for (const row of data ?? []) {
      const key = `${row.source}:${row.source_id}`
      // Same story can sit in two digests; keep the strongest reaction it got.
      priorByKey.set(key, Math.max(priorByKey.get(key) ?? 0, row.interest_count ?? 0))
    }
  }

  let fresh: typeof pool
  if (allowSeen) {
    /* One upvote is worth more than any gap in feed score, which is what makes
       this a look-back rather than a second copy of the feed's own ranking.
       Capped at 1 so a single runaway story cannot take every slot in its
       medium - the mix and per-publisher caps still have to bite. */
    const ranked = pool.map(c => ({
      ...c,
      score: Math.min(1, c.score + (priorByKey.get(`${c.source}:${c.source_id}`) ?? 0) * 0.15),
    }))
    fresh = selectMix(ranked, limit)
  } else {
    // Skip anything already published, so a long-running story does not
    // reappear week after week.
    const unseen = pool.filter(c => !priorByKey.has(`${c.source}:${c.source_id}`))

    if (!unseen.length) {
      return {
        ok: false,
        reason: 'all_seen',
        message: 'Everything found has already appeared in a previous digest.',
      }
    }

    // Selection runs here, on what is actually available to publish. Mixed by
    // medium first (articles, news, video, HN) and by topic within each.
    fresh = selectMix(unseen, limit)
  }

  // Absent an API key this returns an empty map and the digest still lands,
  // just with blank summaries to fill in by hand.
  const summaries = await summarizeCandidates(fresh)

  const label =
    opts.label?.trim() ||
    (periodStart
      ? kind === 'daily'
        ? dayLabel(periodStart)
        : kind === 'monthly'
          ? monthPeriodLabel(periodStart)
          : weekLabel(periodStart)
      : monthLabel())

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
      /* Only set for feeds that syndicate in full. NULL is not a failure here,
         it is the row telling the UI to link out to the publisher instead. */
      content_html: c.content ?? null,
      reading_minutes: c.readingMinutes ?? null,
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
