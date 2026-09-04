// ROUTE: GET /api/cron/bytes/monthly
// AUTH: shared secret via Authorization: Bearer $CRON_SECRET (NOT a user session)
// PURPOSE: On the 1st of each month, refetch the whole month and publish the
//          strongest items as one "Top of <Month>" digest.
// DB TABLES: byte_digests, bytes, users, push_subscriptions
// RLS: service-role client inside generateDigest (no user context exists here)

import { NextResponse } from 'next/server'
import { generateDigest, monthStart, monthPeriodLabel } from '@/lib/bytes/generate'
import { rejectIfNotCron, firstAdminId } from '@/lib/bytes/cron'
import { notifyOnBytesPublished, notifyAfterResponse } from '@/lib/push/notify'

/**
 * Why a second job rather than a bigger daily one.
 *
 * The every-other-day drop is six items from a three-day window, which is the
 * right shape for a habit and the wrong shape for memory: a story that landed
 * on the 3rd is off the page by the 9th and gone from the archive by the 20th.
 * This pass reopens the full month, re-ranks it with the guild's own upvotes
 * folded in, and puts the ten that mattered back in one place - which is also
 * the list an admin wants in front of them when planning the next meeting.
 *
 * It runs with `allowSeen`, unlike every other path. By the 1st, essentially
 * everything worth collecting has already appeared in some daily drop, so the
 * usual already-published filter would leave this digest holding whatever the
 * daily runs rejected. Repetition is the point here.
 */
const LIMIT = 10
/** A full month, plus a day, so the 31st of a long month is never dropped. */
const DAYS = 32

// A 32-day window across ~34 feeds, then a summarization pass over ten items.
export const maxDuration = 300

export async function GET(request: Request) {
  const rejected = rejectIfNotCron(request)
  if (rejected) return rejected

  const owner = await firstAdminId()
  if (!owner) {
    console.error('cron/bytes/monthly: no admin user to attribute the digest to')
    return NextResponse.json({ error: 'No admin user' }, { status: 500 })
  }

  /* The month that just ended, not the one starting today. The job fires on
     the 1st, and "Top of September" published on 1 October is the retrospective
     a reader expects; labelling it "Top of October" on day one of October would
     be a summary of nothing. */
  const now = new Date()
  const periodStart = monthStart(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1)),
  )

  const result = await generateDigest({
    kind: 'monthly',
    periodStart,
    days: DAYS,
    limit: LIMIT,
    allowSeen: true,
    createdBy: owner,
  })

  if (!result.ok) {
    /* A duplicate is the guard doing its job. `all_seen` cannot happen on this
       path - allowSeen is on - and `no_candidates` means every feed failed at
       once, which is worth a log. */
    const expected = result.reason === 'duplicate_period'
    if (!expected) console.error('cron/bytes/monthly:', result.reason, result.message)
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
    label: result.label ?? monthPeriodLabel(periodStart),
    count: result.count,
    summarized: result.summarized,
    period_start: periodStart,
  })
}
