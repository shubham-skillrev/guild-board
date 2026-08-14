import 'server-only'
import { classifyDomain, selectForBreadth, type Domain } from '@/lib/bytes/domains'

/**
 * Feed sources for the digest.
 *
 * Every field here comes from a real HTTP response. Nothing in this file is
 * model-generated, and `title`/`url` are passed through to the database
 * untouched, see lib/bytes/summarize.ts for why that matters.
 *
 * All four APIs are free and keyless.
 */

export type ByteSource = 'hn' | 'devto' | 'github' | 'lobsters'

export interface Candidate {
  source: ByteSource
  /** Stable id from the upstream API, used to dedupe and to match LLM output. */
  source_id: string
  title: string
  url: string
  /** Upvotes / reactions / stars. Not comparable across sources, see normalize(). */
  points: number
  /** Short excerpt passed to the summarizer for context. */
  excerpt?: string
  /** Topic bucket, used to spread the digest across areas. */
  domain: Domain
  /** Cross-source comparable rank, 0 to 1. */
  score: number
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

/**
 * Map raw points onto a comparable 0 to 1 scale.
 *
 * 3000 HN points, 900 dev.to reactions and 40000 GitHub stars all mean "this
 * did well on its own platform", so each source gets its own reference point
 * and a log curve, which stops one viral repo from dominating every bucket.
 */
function normalize(points: number, reference: number): number {
  if (points <= 0) return 0
  return Math.min(1, Math.log10(points + 1) / Math.log10(reference + 1))
}

/** Hacker News via the Algolia search API. Free, keyless. */
async function fetchHN(sinceUnix: number): Promise<Candidate[]> {
  const url =
    `https://hn.algolia.com/api/v1/search?tags=story` +
    `&numericFilters=created_at_i>${sinceUnix},points>100` +
    `&hitsPerPage=40`

  const data = await getJson<{
    hits: {
      objectID: string
      title: string | null
      url: string | null
      points: number | null
      story_text?: string | null
    }[]
  }>(url)

  return (data?.hits ?? [])
    .filter(h => h.title)
    .map(h => {
      const excerpt = h.story_text?.slice(0, 500) ?? undefined
      return {
        source: 'hn' as const,
        source_id: h.objectID,
        title: h.title!,
        // Ask HN and similar have no external URL, link to the discussion.
        url: h.url ?? `https://news.ycombinator.com/item?id=${h.objectID}`,
        points: h.points ?? 0,
        excerpt,
        domain: classifyDomain(h.title!, excerpt),
        score: normalize(h.points ?? 0, 2000),
      }
    })
}

/** Lobsters. Systems and languages heavy, complements HN rather than echoing it. */
async function fetchLobsters(): Promise<Candidate[]> {
  const data = await getJson<{
    short_id: string
    title: string
    url: string
    score: number
    description_plain?: string
    tags?: string[]
  }[]>('https://lobste.rs/hottest.json')

  return (data ?? [])
    .filter(s => s.title && s.url)
    .map(s => {
      const excerpt = s.description_plain?.slice(0, 500) || undefined
      // Lobsters ships curated tags, so classify against those first and let
      // the title act as a fallback.
      const tagText = (s.tags ?? []).join(' ')
      return {
        source: 'lobsters' as const,
        source_id: s.short_id,
        title: s.title,
        url: s.url,
        points: s.score ?? 0,
        excerpt,
        domain: classifyDomain(`${tagText} ${s.title}`, excerpt),
        score: normalize(s.score ?? 0, 80),
      }
    })
}

/** dev.to top articles. Free, keyless. */
async function fetchDevto(days: number): Promise<Candidate[]> {
  const data = await getJson<
    {
      id: number
      title: string
      url: string
      positive_reactions_count: number
      description?: string
      tag_list?: string[]
    }[]
  >(`https://dev.to/api/articles?top=${days}&per_page=40`)

  return (data ?? []).map(a => {
    const excerpt = a.description?.slice(0, 500)
    const tagText = (a.tag_list ?? []).join(' ')
    return {
      source: 'devto' as const,
      source_id: String(a.id),
      title: a.title,
      url: a.url,
      points: a.positive_reactions_count ?? 0,
      excerpt,
      domain: classifyDomain(`${tagText} ${a.title}`, excerpt),
      score: normalize(a.positive_reactions_count ?? 0, 400),
    }
  })
}

/**
 * Recently-created repos by stars, via the GitHub Search API.
 * 60 requests/hour unauthenticated, ample for a weekly job.
 * Deliberately not scraping the trending HTML page.
 */
async function fetchGitHub(sinceISO: string): Promise<Candidate[]> {
  const since = sinceISO.slice(0, 10)
  const url =
    `https://api.github.com/search/repositories` +
    `?q=created:>${since}+stars:>50&sort=stars&order=desc&per_page=25`

  const data = await getJson<{
    items: {
      id: number
      full_name: string
      html_url: string
      stargazers_count: number
      description: string | null
      topics?: string[]
      language?: string | null
    }[]
  }>(url)

  return (data?.items ?? []).map(r => {
    const excerpt = r.description?.slice(0, 500) ?? undefined
    const meta = [(r.topics ?? []).join(' '), r.language ?? ''].join(' ')
    return {
      source: 'github' as const,
      source_id: String(r.id),
      title: r.full_name,
      url: r.html_url,
      points: r.stargazers_count ?? 0,
      excerpt,
      domain: classifyDomain(`${meta} ${r.full_name} ${excerpt ?? ''}`, excerpt),
      score: normalize(r.stargazers_count ?? 0, 8000),
    }
  })
}

/**
 * Gather candidates across all sources for the last `days` days, then pick a
 * spread rather than a straight top-N.
 *
 * A source that fails is skipped rather than failing the run, since a digest
 * from three sources beats no digest at all.
 */
export async function fetchCandidates(days = 8, limit = 10): Promise<Candidate[]> {
  const sinceMs = Date.now() - days * 24 * 60 * 60 * 1000
  const sinceUnix = Math.floor(sinceMs / 1000)
  const sinceISO = new Date(sinceMs).toISOString()

  const results = await Promise.all([
    fetchHN(sinceUnix),
    fetchLobsters(),
    fetchDevto(days),
    fetchGitHub(sinceISO),
  ])

  // Drop duplicates by URL, keeping the highest scoring copy. The same article
  // frequently lands on both HN and Lobsters in the same week.
  const byUrl = new Map<string, Candidate>()
  for (const candidate of results.flat()) {
    const key = candidate.url.replace(/\/+$/, '').toLowerCase()
    const existing = byUrl.get(key)
    if (!existing || candidate.score > existing.score) byUrl.set(key, candidate)
  }

  return selectForBreadth([...byUrl.values()], limit)
}
