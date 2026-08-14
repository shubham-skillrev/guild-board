import 'server-only'

/**
 * Feed sources for the monthly digest.
 *
 * Every field here comes from a real HTTP response. Nothing in this file is
 * model-generated, and `title`/`url` are passed through to the database
 * untouched — see lib/bytes/summarize.ts for why that matters.
 *
 * All three APIs are free and keyless.
 */

export type ByteSource = 'hn' | 'devto' | 'github'

export interface Candidate {
  source: ByteSource
  /** Stable id from the upstream API — used to dedupe and to match LLM output. */
  source_id: string
  title: string
  url: string
  /** Upvotes / reactions / stars, for ranking. Not comparable across sources. */
  points: number
  /** Short excerpt passed to the summarizer for context. */
  excerpt?: string
}

const UA = 'guildboard-bytes/1.0'

async function getJson<T>(url: string, timeoutMs = 10_000): Promise<T | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/json' },
      signal: controller.signal,
      cache: 'no-store',
    })
    if (!res.ok) {
      console.warn(`bytes: ${url} returned ${res.status}`)
      return null
    }
    return (await res.json()) as T
  } catch (err) {
    console.warn(`bytes: ${url} failed`, err)
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Hacker News via the Algolia search API. Free, keyless. */
async function fetchHN(sinceUnix: number): Promise<Candidate[]> {
  const url =
    `https://hn.algolia.com/api/v1/search?tags=story` +
    `&numericFilters=created_at_i>${sinceUnix},points>150` +
    `&hitsPerPage=30`

  const data = await getJson<{
    hits: { objectID: string; title: string | null; url: string | null; points: number | null; story_text?: string | null }[]
  }>(url)

  return (data?.hits ?? [])
    .filter(h => h.title && (h.url || h.objectID))
    .map(h => ({
      source: 'hn' as const,
      source_id: h.objectID,
      title: h.title!,
      // Ask HN and similar have no external URL — link to the discussion.
      url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
      points: h.points ?? 0,
      excerpt: h.story_text?.slice(0, 500) ?? undefined,
    }))
}

/** dev.to top articles. Free, keyless. */
async function fetchDevto(days: number): Promise<Candidate[]> {
  const data = await getJson<
    { id: number; title: string; url: string; positive_reactions_count: number; description?: string }[]
  >(`https://dev.to/api/articles?top=${days}&per_page=30`)

  return (data ?? []).map(a => ({
    source: 'devto' as const,
    source_id: String(a.id),
    title: a.title,
    url: a.url,
    points: a.positive_reactions_count ?? 0,
    excerpt: a.description?.slice(0, 500),
  }))
}

/**
 * Recently-created repos by stars, via the GitHub Search API.
 * 60 requests/hour unauthenticated — ample for a monthly job.
 * Deliberately not scraping the trending HTML page.
 */
async function fetchGitHub(sinceISO: string): Promise<Candidate[]> {
  const since = sinceISO.slice(0, 10)
  const url =
    `https://api.github.com/search/repositories` +
    `?q=created:>${since}+stars:>100&sort=stars&order=desc&per_page=20`

  const data = await getJson<{
    items: { id: number; full_name: string; html_url: string; stargazers_count: number; description: string | null }[]
  }>(url)

  return (data?.items ?? []).map(r => ({
    source: 'github' as const,
    source_id: String(r.id),
    title: r.full_name,
    url: r.html_url,
    points: r.stargazers_count ?? 0,
    excerpt: r.description?.slice(0, 500) ?? undefined,
  }))
}

/**
 * Gather candidates across all sources for the last `days` days.
 *
 * A source that fails is skipped rather than failing the run — a digest with
 * two sources beats no digest at all.
 */
export async function fetchCandidates(days = 35): Promise<Candidate[]> {
  const sinceMs = Date.now() - days * 24 * 60 * 60 * 1000
  const sinceUnix = Math.floor(sinceMs / 1000)
  const sinceISO = new Date(sinceMs).toISOString()

  const [hn, devto, github] = await Promise.all([
    fetchHN(sinceUnix),
    fetchDevto(days),
    fetchGitHub(sinceISO),
  ])

  // Rank within each source (points aren't comparable across sources), then
  // interleave so one busy source can't crowd out the others.
  const ranked = [hn, devto, github].map(list =>
    [...list].sort((a, b) => b.points - a.points),
  )

  const out: Candidate[] = []
  const seenUrls = new Set<string>()
  for (let i = 0; out.length < 12; i++) {
    let addedThisRound = false
    for (const list of ranked) {
      const item = list[i]
      if (!item) continue
      addedThisRound = true
      if (seenUrls.has(item.url)) continue
      seenUrls.add(item.url)
      out.push(item)
      if (out.length >= 12) break
    }
    if (!addedThisRound) break
  }

  return out
}
