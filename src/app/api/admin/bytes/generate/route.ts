// ROUTE: POST /api/admin/bytes/generate
// AUTH: admin only
// PURPOSE: Fetch real feed items, summarize them, and publish a digest on the
//          spot. Two modes: `fresh` pulls what has not run before, `monthly`
//          rebuilds a top-of-month look-back over the last 32 days.
// DB TABLES: byte_digests, bytes, cycles, users
// RLS: server client for identity; admin client for writes (drafts are not
//      readable under RLS by design)

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { generateDigest, monthStart } from '@/lib/bytes/generate'
import { notifyOnBytesPublished, notifyAfterResponse } from '@/lib/push/notify'

export const maxDuration = 120

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  const { data: me } = await admin
    .from('users')
    .select('role')
    .eq('id', user.id)
    .maybeSingle()

  if (me?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: {
    days?: number
    cycle_id?: string
    label?: string
    mode?: 'fresh' | 'monthly'
  } = {}
  try { body = await request.json() } catch { /* all fields optional */ }

  const monthly = body.mode === 'monthly'

  /* The same look-back the 1st-of-the-month cron builds, on demand.
     `allowSeen` is the whole difference: by the end of a month every item
     worth collecting has already run in some daily drop, so a top-of-month
     pass that filtered those out would return the leftovers. Repetition is
     the point - see the monthly cron route.

     Ad-hoc runs carry no period_start and so never collide with the period a
     scheduled job owns; a manual monthly can be re-run as often as the admin
     likes without the unique index rejecting it. */
  const result = await generateDigest({
    kind: 'monthly',
    days: monthly ? 32 : Math.min(Math.max(body.days ?? 30, 1), 90),
    limit: 10,
    allowSeen: monthly,
    label:
      body.label ??
      (monthly
        ? `Top of ${new Date(`${monthStart()}T00:00:00Z`).toLocaleDateString('en-US', {
            month: 'long',
            timeZone: 'UTC',
          })}, so far`
        : undefined),
    cycleId: body.cycle_id ?? null,
    createdBy: user.id,
  })

  if (!result.ok) {
    const status = result.reason === "all_seen" ? 409
      : result.reason === "no_candidates" ? 502
      : 500
    return NextResponse.json({ error: result.message }, { status })
  }

  /* generateDigest publishes on creation, so an admin run is as live as the
     cron one and has to announce itself the same way. It did not, which meant a
     manually generated digest sat on the page with nobody told it existed. */
  notifyAfterResponse(
    notifyOnBytesPublished({ label: result.label, count: result.count, mix: result.mix }),
    'notifyOnBytesPublished',
  )

  return NextResponse.json(
    {
      digest_id: result.digestId,
      label: result.label,
      count: result.count,
      summarized: result.summarized,
      mix: result.mix,
      // Surfaced so the admin knows to write summaries by hand.
      llm_available: !!process.env.ANTHROPIC_API_KEY,
    },
    { status: 201 },
  )
}
