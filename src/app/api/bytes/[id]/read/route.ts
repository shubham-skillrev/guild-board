// ROUTE: GET /api/bytes/[id]/read
// AUTH: authenticated
// PURPOSE: One byte plus its article body, for the in-app reader. Extracts and
//          caches the body on first open; every later open is a table read.
// DB TABLES: bytes, byte_interests
// RLS: server client for the read (published-only policies do the filtering);
//      admin client for the cache write, since members cannot UPDATE bytes

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { extractArticle } from '@/lib/bytes/content'
import { READABLE_SOURCES } from '@/lib/bytes/labels'

// Extraction is a network round trip to a third party against a cold page.
export const maxDuration = 60

/** Retry window after a failed extraction. See migration 020. */
const RETRY_AFTER_HOURS = 24

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
    .select('id, digest_id, source, source_id, source_title, source_name, url, thumbnail_url, source_points, summary, tags, editor_note, domain, interest_count, seeded_topic_id, content_md, content_source, content_failed_at, reading_minutes')
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

  const withUser = { ...byte, user_interested: !!mine }

  // Already cached, or a format with nothing to transcribe. A video's body is
  // the video, which the reader embeds instead.
  if (byte.content_md || !READABLE_SOURCES.has(byte.source)) {
    return NextResponse.json({ byte: withUser })
  }

  /* A page that could not be extracted fails the same way every time -
     paywall, login wall, JS-only render - so a member refreshing must not
     re-run the extractor on every view. */
  if (byte.content_failed_at) {
    const hours = (Date.now() - new Date(byte.content_failed_at).getTime()) / 3_600_000
    if (hours < RETRY_AFTER_HOURS) {
      return NextResponse.json({ byte: withUser, unreadable: true })
    }
  }

  const extracted = await extractArticle(byte.url)
  const admin = createAdminClient()

  if (!extracted) {
    await admin
      .from('bytes')
      .update({ content_failed_at: new Date().toISOString() })
      .eq('id', id)

    return NextResponse.json({ byte: withUser, unreadable: true })
  }

  await admin
    .from('bytes')
    .update({
      content_md: extracted.markdown,
      content_source: extracted.source,
      content_fetched_at: new Date().toISOString(),
      content_failed_at: null,
      reading_minutes: extracted.readingMinutes,
    })
    .eq('id', id)

  return NextResponse.json({
    byte: {
      ...withUser,
      content_md: extracted.markdown,
      content_source: extracted.source,
      reading_minutes: extracted.readingMinutes,
    },
  })
}
