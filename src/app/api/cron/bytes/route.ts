// ROUTE: GET /api/cron/bytes
// AUTH: shared secret via Authorization: Bearer $CRON_SECRET (NOT a user session)
// PURPOSE: Every-other-day auto-fetch. Builds and publishes a small digest so
//          Bytes is a standing habit rather than a once-a-month event.
// DB TABLES: byte_digests, bytes, users, push_subscriptions
// RLS: service-role client inside generateDigest (no user context exists here)

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateDigest, dayStart } from '@/lib/bytes/generate'
import { rejectIfNotCron, firstAdminId } from '@/lib/bytes/cron'
import { notifyOnBytesPublished, notifyAfterResponse } from '@/lib/push/notify'

/* Cadence, in one place.
   Measured against the live feeds before choosing: a 2-day window returns ~57
   candidates from ~34 publishers, which is enough for the medium mix to have
   real choice. A 1-day window returns only two videos, so the digest's one
   talk would be whichever channel happened to post. */
const LIMIT = 6
/** Lookback. One day of overlap so a late-evening post is never missed. */
const DAYS = 3
/** Minimum gap between digests, in hours. See the guard below. */
const MIN_GAP_HOURS = 36

// Fetching four feeds plus a summarization pass can exceed the default limit.
export const maxDuration = 120

export async function GET(request: Request) {
  const rejected = rejectIfNotCron(request)
  if (rejected) return rejected

  const owner = await firstAdminId()
  if (!owner) {
    console.error('cron/bytes: no admin user to attribute the digest to')
    return NextResponse.json({ error: 'No admin user' }, { status: 500 })
  }

  const admin = createAdminClient()

  /* The schedule is `0 6 *​/2 * *`, which is every other day *of the month* -
     so a 31-day month runs the 31st and then the 1st back to back. This guard
     is what actually enforces the cadence; the cron expression only decides
     which mornings it is even considered.

     Scoped to daily digests. It used to look at every digest, which meant the
     monthly top-of-month run - firing on the 1st, one hour after this one -
     would suppress the next two daily drops for being "too soon". The two jobs
     produce different things and must not gate each other. */
  const { data: last } = await admin
    .from('byte_digests')
    .select('published_at')
    .eq('kind', 'daily')
    .not('published_at', 'is', null)
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (last?.published_at) {
    const hours = (Date.now() - new Date(last.published_at).getTime()) / 3_600_000
    if (hours < MIN_GAP_HOURS) {
      return NextResponse.json({
        skipped: true,
        reason: 'too_soon',
        message: `Last digest was ${hours.toFixed(1)}h ago, minimum gap is ${MIN_GAP_HOURS}h.`,
      })
    }
  }

  const periodStart = dayStart()

  const result = await generateDigest({
    kind: 'daily',
    periodStart,
    days: DAYS,
    limit: LIMIT,
    createdBy: owner,
  })

  if (!result.ok) {
    // A duplicate or an empty week is normal, not a failure worth alerting on.
    const expected = result.reason === 'duplicate_period' || result.reason === 'all_seen'
    if (!expected) console.error('cron/bytes:', result.reason, result.message)
    return NextResponse.json(
      { skipped: true, reason: result.reason, message: result.message },
      { status: expected ? 200 : 500 },
    )
  }

  notifyAfterResponse(
    notifyOnBytesPublished({ label: result.label, count: result.count, mix: result.mix }),
    'notifyOnBytesPublished',
  )

  return NextResponse.json({
    published: true,
    digest_id: result.digestId,
    label: result.label,
    count: result.count,
    summarized: result.summarized,
    period_start: periodStart,
  })
}
