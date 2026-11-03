// ROUTE: GET /api/bytes/[id]
// AUTH: authenticated
// PURPOSE: One byte as a brief: summary, try-this lines, resources and the
//          link to the original. Never the article itself (migration 039).
// DB TABLES: bytes, byte_interests
// RLS: server client (published-only policies do the filtering)

import { getViewer } from '@/lib/supabase/viewer'
import { NextResponse } from 'next/server'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const { supabase, user, isGuest } = await getViewer()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: byte } = await supabase
    .from('bytes')
    // Every column, so the page works on either side of migration 039 (the
    // brief columns appear with it). The article body is never sent.
    .select('*')
    .eq('id', id)
    .maybeSingle()

  // RLS hides bytes in unpublished digests, so "hidden" and "gone" are the
  // same 404 here on purpose.
  if (!byte) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Guests read past RLS, so check the digest is published by hand.
  if (isGuest) {
    const { data: digest } = await supabase
      .from('byte_digests')
      .select('id')
      .eq('id', byte.digest_id)
      .eq('status', 'published')
      .maybeSingle()
    if (!digest) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const { data: mine } = await supabase
    .from('byte_interests')
    .select('byte_id')
    .eq('user_id', user.id)
    .eq('byte_id', id)
    .maybeSingle()

  const { content_html: _body, brief_at: _briefAt, source_id: _sourceId, ...brief } = byte
  return NextResponse.json({
    byte: {
      ...brief,
      actions: Array.isArray(byte.actions) ? byte.actions : [],
      resources: Array.isArray(byte.resources) ? byte.resources : [],
      user_interested: !!mine,
    },
  })
}
