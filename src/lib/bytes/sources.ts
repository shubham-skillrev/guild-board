import 'server-only'
import { XMLParser } from 'fast-xml-parser'
import { classifyDomain, selectForBreadth, type Domain } from '@/lib/bytes/domains'

/**
 * Feed sources for the digest.
 *
 * Every field here comes from a real HTTP response. Nothing in this file is
 * model-generated, and `title`/`url` are passed through to the database
 * untouched, see lib/bytes/summarize.ts for why that matters.
 *
 * All sources are free and keyless.
 */

export type ByteSource = 'blog' | 'hn' | 'github'

/**
 * Engineering blogs, read straight from their own feeds.
 *
 * This is the primary source now, and the reason is that the source itself is
 * the filter. An aggregator ranks whatever the crowd upvoted that day, which is
 * how the digest ended up leading with "I hate packaging my software for Linux":
 * a popular post, but an opinion, not an article, and nothing a guild can act
 * on. A team's engineering blog only publishes when that team shipped or learned
 * something, so every item is on topic by construction and no amount of ranking
 * has to compensate.
 */
const BLOG_FEEDS: { name: string; url: string }[] = [
  { name: 'Cloudflare', url: 'https://blog.cloudflare.com/rss/' },
  { name: 'Netflix', url: 'https://netflixtechblog.com/feed' },
  { name: 'Stripe', url: 'https://stripe.com/blog/feed.rss' },
  { name: 'Discord', url: 'https://discord.com/blog/rss.xml' },
  { name: 'GitHub', url: 'https://github.blog/engineering/feed/' },
  { name: 'Meta', url: 'https://engineering.fb.com/feed/' },
  { name: 'Airbnb', url: 'https://medium.com/feed/airbnb-engineering' },
  { name: 'Slack', url: 'https://slack.engineering/feed/' },
  { name: 'Shopify', url: 'https://shopify.engineering/blogs/engineering.atom' },
  { name: 'Pinterest', url: 'https://medium.com/feed/pinterest-engineering' },
  { name: 'Grafana', url: 'https://grafana.com/blog/index.xml' },
  { name: 'Datadog', url: 'https://www.datadoghq.com/blog/engineering/index.xml' },
  // Every URL above was fetched and parsed before being added here. Uber
  // (406 to any non-browser agent), Figma, Dropbox and LinkedIn were dropped
  // for exactly that reason rather than left in to fail silently every Monday.
]

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
 * 3000 HN points and 40000 GitHub stars both mean "this did well on its own
 * platform", so each source gets its own reference point
 * and a log curve, which stops one viral repo from dominating every bucket.
 */
function normalize(points: number, reference: number): number {
  if (points <= 0) return 0
  return Math.min(1, Math.log10(points + 1) / Math.log10(reference + 1))
}

async function getXml(url: string, timeoutMs = 10_000): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/xml, text/xml' },
      signal: controller.signal,
      cache: 'no-store',
    })
    if (!res.ok) {
      console.warn(`bytes: ${url} returned ${res.status}`)
      return null
    }
    return await res.text()
  } catch (err) {
    console.warn(`bytes: ${url} failed`, err)
    return null
  } finally {
    clearTimeout(timer)
  }
}

function firstString(value: unknown): string | undefined {
  const v = Array.isArray(value) ? value[0] : value
  if (typeof v === 'string') return v
  if (v && typeof v === 'object' && '#text' in v) {
    const t = (v as { '#text': unknown })['#text']
    if (typeof t === 'string') return t
  }
  return undefined
}

/** Atom puts the URL in an attribute; RSS puts it in the element body. */
function linkOf(entry: Record<string, unknown>): string | undefined {
  const direct = firstString(entry.link)
  if (direct?.startsWith('http')) return direct

  const link = Array.isArray(entry.link) ? entry.link[0] : entry.link
  if (link && typeof link === 'object') {
    const href = (link as Record<string, unknown>)['@_href']
    if (typeof href === 'string') return href
  }
  return undefined
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

/**
 * Engineering blogs via their own RSS/Atom feeds. Free, keyless.
 *
 * One failing feed must never take the digest down with it, so each is fetched
 * independently and a null simply contributes nothing.
 */
async function fetchBlogs(sinceMs: number): Promise<Candidate[]> {
  const parser = new XMLParser({ ignoreAttributes: false, trimValues: true })

  const perFeed = await Promise.all(
    BLOG_FEEDS.map(async feed => {
      const xml = await getXml(feed.url)
      if (!xml) return []

      // Feed shapes vary enough between RSS 2.0 and Atom that the parsed tree
      // is genuinely unknown here; it is narrowed by the guards below.
      let doc: Record<string, Record<string, unknown> | undefined>
      try {
        doc = parser.parse(xml)
      } catch (err) {
        console.warn(`bytes: could not parse ${feed.url}`, err)
        return []
      }

      const rss = doc?.rss as { channel?: Record<string, unknown> } | undefined
      const channel = rss?.channel ?? doc?.feed ?? {}
      const rawItems = channel.item ?? channel.entry ?? []
      const items: Record<string, unknown>[] = Array.isArray(rawItems) ? rawItems : [rawItems]

      /* Cap per feed. Verified against a live run: Cloudflare alone published
         15 of the 23 articles across all twelve blogs in one week, so without
         this the digest becomes one company's newsletter. Feeds are ordered
         newest-first, so taking the head keeps the most recent. */
      const PER_FEED_MAX = 3

      const out: Candidate[] = []
      for (const item of items) {
        if (out.length >= PER_FEED_MAX) break
        const title = firstString(item.title)
        const url = linkOf(item)
        if (!title || !url) continue

        // Recency is the only filter a curated feed needs.
        const dateText =
          firstString(item.pubDate) ?? firstString(item.published) ?? firstString(item.updated)
        const published = dateText ? new Date(dateText).getTime() : NaN
        if (Number.isFinite(published) && published < sinceMs) continue

        const rawExcerpt =
          firstString(item.description) ??
          firstString(item.summary) ??
          firstString(item['content:encoded'])
        const excerpt = rawExcerpt ? stripHtml(rawExcerpt).slice(0, 500) : undefined

        out.push({
          source: 'blog',
          source_id: `blog:${url}`,
          title: `${feed.name}: ${title}`,
          url,
          // Blogs carry no public engagement number. They score high by
          // default because being published by an engineering team IS the
          // signal, which is the entire reason for preferring them.
          points: 0,
          excerpt,
          domain: classifyDomain(`${title} ${excerpt ?? ''}`),
          score: 0.75,
        })
      }
      return out
    }),
  )

  return perFeed.flat()
}

/* Hosts that are discussion, video or aggregation rather than an article. A
   link to one of these is a link to a thread, not something to read. */
const HN_BLOCKED_HOSTS = [
  'twitter.com',
  'x.com',
  'reddit.com',
  'news.ycombinator.com',
  'youtube.com',
  'youtu.be',
  'linkedin.com',
  'mastodon.social',
  'bsky.app',
]

/**
 * Hacker News via the Algolia search API. Free, keyless.
 *
 * Now a secondary source with a hard quality gate. The floor is 300 points
 * rather than 100, and anything without an off-site article URL is dropped
 * outright: Ask HN and Show HN threads are conversations, and pointing the
 * digest at a comment page gives a reader nothing to read.
 */
async function fetchHN(sinceUnix: number): Promise<Candidate[]> {
  const url =
    `https://hn.algolia.com/api/v1/search?tags=story` +
    `&numericFilters=created_at_i>${sinceUnix},points>300` +
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
    .filter(h => {
      // Must be a real article somewhere else, not a thread on HN itself.
      if (!h.title || !h.url) return false
      if (/^(ask|show|tell) hn[:\s]/i.test(h.title)) return false
      try {
        const host = new URL(h.url).hostname.replace(/^www\./, '')
        return !HN_BLOCKED_HOSTS.some(b => host === b || host.endsWith(`.${b}`))
      } catch {
        return false
      }
    })
    .map(h => {
      const excerpt = h.story_text?.slice(0, 500) ?? undefined
      return {
        source: 'hn' as const,
        source_id: h.objectID,
        title: h.title!,
        url: h.url!,
        points: h.points ?? 0,
        excerpt,
        domain: classifyDomain(h.title!, excerpt),
        score: normalize(h.points ?? 0, 2000),
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

  /* Blogs lead. Hacker News stays as the second source because it is the only
     one that catches something significant published somewhere unexpected, but
     it now has to clear a high score floor and link to an actual article.
     Lobsters and dev.to are gone: both rank community opinion posts alongside
     engineering writing, and that is where the off-topic items came from. */
  const results = await Promise.all([
    fetchBlogs(sinceMs),
    fetchHN(sinceUnix),
    fetchGitHub(sinceISO),
  ])

  // Drop duplicates by URL, keeping the highest scoring copy. The same article
  // frequently lands on both a company blog and HN in the same week.
  const byUrl = new Map<string, Candidate>()
  for (const candidate of results.flat()) {
    const key = candidate.url.replace(/\/+$/, '').toLowerCase()
    const existing = byUrl.get(key)
    if (!existing || candidate.score > existing.score) byUrl.set(key, candidate)
  }

  return selectForBreadth([...byUrl.values()], limit)
}
