// ROUTE: GET /api/bytes/[id]
// AUTH: authenticated
// PURPOSE: One byte and its article body, for the in-app reader. Only rows
//          whose feed syndicated the whole piece have a body; the rest are
//          link-outs and never reach this route.
// DB TABLES: bytes, byte_interests
// RLS: server client (published-only policies do the filtering)

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { sanitizeArticleHtml } from '@/lib/bytes/articleHtml'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: byte } = await supabase
    .from('bytes')
    .select('id, digest_id, source, source_id, source_title, source_name, url, thumbnail_url, source_points, summary, tags, editor_note, domain, interest_count, seeded_topic_id, content_html, reading_minutes')
    .eq('id', id)
    .maybeSingle()

  // RLS hides bytes in unpublished digests, so "hidden" and "gone" are the
  // same 404 here on purpose.
  if (!byte) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: mine } = await supabase
    .from('byte_interests')
    .select('byte_id')
    .eq('user_id', user.id)
    .eq('byte_id', id)
    .maybeSingle()

  return NextResponse.json({
    byte: {
      ...byte,
      /* Filtered here rather than at write time, so closing a hole in the
         allowlist fixes every row already in the table. See articleHtml.ts. */
      content_html: byte.content_html ? sanitizeArticleHtml(byte.content_html) : null,
      user_interested: !!mine,
    },
  })
}
