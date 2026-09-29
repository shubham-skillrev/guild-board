// ROUTE: GET /api/bytes/latest
// AUTH: authenticated
// PURPOSE: Identity of the newest published digest, and nothing else. The nav
//          needs to know whether there is something unread; loading the whole
//          digest on every page render to answer that would be absurd.
// DB TABLES: byte_digests
// RLS: server client (published-only policies do the filtering)

import { getViewer } from '@/lib/supabase/viewer'
import { NextResponse } from 'next/server'

export async function GET() {
  const { supabase, user } = await getViewer()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data } = await supabase
    .from('byte_digests')
    .select('id, label, published_at')
    // RLS already hides drafts from members; guests read past RLS.
    .eq('status', 'published')
    .order('published_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle()

  return NextResponse.json({ digest: data ?? null })
}
