import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { isAiConfigured } from '@/lib/ai'
import { summarizeCandidates } from '@/lib/bytes/summarize'
import { resourcesFrom } from '@/lib/bytes/articleHtml'
import type { Candidate } from '@/lib/bytes/sources'
import type { Domain } from '@/lib/bytes/domains'

/**
 * Turns bytes published before migration 039 into briefs: a fresh summary
 * and "try this" lines from one AI call, the links pulled out of the stored
 * article, and then the stored article deleted. A few at a time from the
 * daily cron, newest first, so the free tier is never the bottleneck.
 *
 * A row is only marked done once the model answered for it (or there is no
 * AI key at all), so a rate-limited day leaves it for tomorrow with its text
 * intact instead of losing the chance to summarise it properly.
 */
export async function convertOldBytes(limit = 12): Promise<{ converted: number; pending: boolean }> {
  const admin = createAdminClient()
  const { data, error } = await admin
    .from('bytes')
    .select('id, source, source_id, source_title, source_name, url, domain, summary, content_html')
    .is('brief_at', null)
    .order('created_at', { ascending: false })
    .limit(limit)
  // Before migration 039 there is no brief_at column: nothing to do.
  if (error || !data?.length) return { converted: 0, pending: false }

  const candidates: Candidate[] = data.map(b => ({
    source: b.source,
    source_id: b.source_id,
    title: b.source_title,
    source_name: b.source_name ?? '',
    url: b.url,
    points: 0,
    excerpt: b.summary ?? undefined,
    content: b.content_html ?? undefined,
    domain: (b.domain ?? 'other') as Domain,
    score: 0,
  }))
  const briefs = await summarizeCandidates(candidates)
  const noAi = !isAiConfigured()

  let converted = 0
  for (const b of data) {
    const brief = briefs.get(b.source_id)
    if (!brief && !noAi) continue
    const { error: updateErr } = await admin
      .from('bytes')
      .update({
        ...(brief ? { summary: brief.summary, tags: brief.tags, actions: brief.actions.length ? brief.actions : null } : {}),
        resources: resourcesFrom(b.content_html, b.url),
        content_html: null,
        brief_at: new Date().toISOString(),
      })
      .eq('id', b.id)
    if (!updateErr) converted += 1
  }
  return { converted, pending: data.length === limit || converted < data.length }
}

/** How many bytes still need turning into briefs. */
export async function briefsLeft(): Promise<number> {
  const { count, error } = await createAdminClient().from('bytes').select('id', { count: 'exact', head: true }).is('brief_at', null)
  return error ? 0 : count ?? 0
}
