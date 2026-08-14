// ROUTE: GET /api/cron/bytes
// AUTH: shared secret via Authorization: Bearer $CRON_SECRET (NOT a user session)
// PURPOSE: Weekly auto-fetch. Builds and publishes the week's digest so Bytes
//          is a standing habit rather than a once-a-month event.
// DB TABLES: byte_digests, bytes, users, push_subscriptions
// RLS: service-role client inside generateDigest (no user context exists here)

import { NextResponse } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { createAdminClient } from '@/lib/supabase/admin'
import { generateDigest, weekStart } from '@/lib/bytes/generate'
import { notifyOnBytesPublished, notifyAfterResponse } from '@/lib/push/notify'

// Fetching four feeds plus a summarization pass can exceed the default limit.
export const maxDuration = 120
export const dynamic = 'force-dynamic'

/** Constant-time compare so the secret cannot be recovered by timing. */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('cron/bytes: CRON_SECRET is not set, refusing to run')
    return NextResponse.json({ error: 'Not configured' }, { status: 500 })
  }

  // Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
  const header = request.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token || !secretMatches(token, secret)) {
    // Deliberately vague: this endpoint should not confirm it exists.
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const admin = createAdminClient()

  // Digests need a creator. Attribute automatic runs to an admin account.
  const { data: owner } = await admin
    .from('users')
    .select('id')
    .eq('role', 'admin')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (!owner) {
    console.error('cron/bytes: no admin user to attribute the digest to')
    return NextResponse.json({ error: 'No admin user' }, { status: 500 })
  }

  const periodStart = weekStart()

  const result = await generateDigest({
    kind: 'weekly',
    periodStart,
    days: 8,          // slight overlap so a story posted late is not missed
    limit: 10,
    createdBy: owner.id,
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
