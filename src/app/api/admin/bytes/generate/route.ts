// ROUTE: POST /api/admin/bytes/generate
// AUTH: admin only
// PURPOSE: Fetch real feed items, summarize them, and create a DRAFT digest.
//          Admin-triggered rather than cron: the admin already runs a monthly
//          ritual, and an unreviewed LLM digest going to the whole guild would
//          eventually publish something wrong.
// DB TABLES: byte_digests, bytes, cycles, users
// RLS: server client for identity; admin client for writes (drafts are not
//      readable under RLS by design)

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { generateDigest } from '@/lib/bytes/generate'
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

  let body: { days?: number; cycle_id?: string; label?: string } = {}
  try { body = await request.json() } catch { /* all fields optional */ }

  // Ad-hoc run alongside the weekly job. No period_start, so it never
  // collides with the week the scheduled job owns.
  const result = await generateDigest({
    kind: "monthly",
    days: Math.min(Math.max(body.days ?? 30, 1), 90),
    limit: 10,
    label: body.label,
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
