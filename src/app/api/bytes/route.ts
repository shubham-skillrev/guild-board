// ROUTE: GET /api/bytes
// AUTH: authenticated
// PURPOSE: The current published digest, with this member's interest taps.
//          Drafts are excluded by RLS, not by this query.
// DB TABLES: byte_digests, bytes, byte_interests
// RLS: server client (published-only policies do the filtering)

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: digest } = await supabase
    .from('byte_digests')
    .select('id, label, published_at')
    .order('published_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!digest) return NextResponse.json({ digest: null, bytes: [] })

  const [{ data: bytes }, { data: mine }] = await Promise.all([
    supabase
      .from('bytes')
      .select('id, source, source_title, url, source_points, summary, tags, editor_note, interest_count, seeded_topic_id, position')
      .eq('digest_id', digest.id)
      .order('position', { ascending: true }),
    supabase.from('byte_interests').select('byte_id').eq('user_id', user.id),
  ])

  const mineSet = new Set((mine ?? []).map(i => i.byte_id))

  return NextResponse.json({
    digest,
    bytes: (bytes ?? []).map(b => ({ ...b, user_interested: mineSet.has(b.id) })),
  })
}
