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
import { fetchCandidates } from '@/lib/bytes/sources'
import { summarizeCandidates } from '@/lib/bytes/summarize'

export const maxDuration = 60

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

  const days = Math.min(Math.max(body.days ?? 35, 1), 90)

  const candidates = await fetchCandidates(days)
  if (!candidates.length) {
    return NextResponse.json(
      { error: 'No stories came back from any feed. Try again in a moment.' },
      { status: 502 },
    )
  }

  // Skip anything already published in an earlier digest, so a long-running
  // story doesn't reappear month after month.
  const { data: seen } = await admin
    .from('bytes')
    .select('source, source_id')
    .in('source_id', candidates.map(c => c.source_id))

  const seenKeys = new Set((seen ?? []).map(s => `${s.source}:${s.source_id}`))
  const fresh = candidates.filter(c => !seenKeys.has(`${c.source}:${c.source_id}`))

  if (!fresh.length) {
    return NextResponse.json(
      { error: 'Everything found has already appeared in a previous digest.' },
      { status: 409 },
    )
  }

  // Absent an API key this returns an empty map and the digest is created with
  // blank summaries for the admin to write by hand.
  const summaries = await summarizeCandidates(fresh)

  const label = body.label?.trim() || defaultLabel()

  const { data: digest, error: digestErr } = await admin
    .from('byte_digests')
    .insert({
      cycle_id: body.cycle_id ?? null,
      label,
      status: 'draft',
      created_by: user.id,
    })
    .select()
    .single()

  if (digestErr) return NextResponse.json({ error: digestErr.message }, { status: 500 })

  // source_title and url are written straight from the feed response. Nothing
  // the model returned can reach these two columns.
  const rows = fresh.map((c, i) => {
    const s = summaries.get(c.source_id)
    return {
      digest_id: digest.id,
      source: c.source,
      source_id: c.source_id,
      source_title: c.title,
      url: c.url,
      source_points: c.points,
      summary: s?.summary ?? null,
      tags: s?.tags ?? null,
      position: i,
    }
  })

  const { error: bytesErr } = await admin.from('bytes').insert(rows)
  if (bytesErr) {
    await admin.from('byte_digests').delete().eq('id', digest.id)
    return NextResponse.json({ error: bytesErr.message }, { status: 500 })
  }

  return NextResponse.json(
    {
      digest_id: digest.id,
      label,
      count: rows.length,
      summarized: summaries.size,
      // Surfaced so the admin knows to write summaries by hand.
      llm_available: !!process.env.ANTHROPIC_API_KEY,
    },
    { status: 201 },
  )
}

function defaultLabel(): string {
  const now = new Date()
  return `${now.toLocaleString('en-US', { month: 'long' })} ${now.getFullYear()} Bytes`
}
