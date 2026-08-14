import 'server-only'
import { XMLParser } from 'fast-xml-parser'
import { classifyDomain, type Domain } from '@/lib/bytes/domains'

/**
 * Feed sources for the digest.
 *
 * Every field here comes from a real HTTP response. Nothing in this file is
 * model-generated, and `title`/`url` are passed through to the database
 * untouched, see lib/bytes/summarize.ts for why that matters.
 *
 * All sources are free and keyless.
 *
 * ── What belongs in a digest ─────────────────────────────────────────────
 * Something a person can read or watch, and then have an opinion about. That
 * rules out the GitHub trending API, which was a source until now: a row
 * reading `owner/repo · 4,102` is a link with no argument attached, and asking
 * a guild to discuss it is asking them to go do the research first. Every
 * source below ships prose or a talk.
 */

export type ByteSource = 'blog' | 'news' | 'video' | 'hn'

/** Everything that arrives as RSS/Atom shares one fetch and parse path. */
interface FeedSpec {
  name: string
  url: string
  kind: Extract<ByteSource, 'blog' | 'news' | 'video'>
}

/**
 * Engineering blogs, read straight from their own feeds.
 *
 * The source itself is the filter. An aggregator ranks whatever the crowd
 * upvoted that day, which is how the digest once ended up leading with "I hate
 * packaging my software for Linux": a popular post, but an opinion, not an
 * article, and nothing a guild can act on. A team's engineering blog only
 * publishes when that team shipped or learned something, so every item is on
 * topic by construction and no amount of ranking has to compensate.
 */
const BLOG_FEEDS: FeedSpec[] = [
  { name: 'Cloudflare', url: 'https://blog.cloudflare.com/rss/', kind: 'blog' },
  { name: 'Netflix', url: 'https://netflixtechblog.com/feed', kind: 'blog' },
  { name: 'Stripe', url: 'https://stripe.com/blog/feed.rss', kind: 'blog' },
  { name: 'GitHub', url: 'https://github.blog/engineering/feed/', kind: 'blog' },
  { name: 'Meta', url: 'https://engineering.fb.com/feed/', kind: 'blog' },
  { name: 'Airbnb', url: 'https://medium.com/feed/airbnb-engineering', kind: 'blog' },
  { name: 'Slack', url: 'https://slack.engineering/feed/', kind: 'blog' },
  { name: 'Shopify', url: 'https://shopify.engineering/blogs/engineering.atom', kind: 'blog' },
  { name: 'Pinterest', url: 'https://medium.com/feed/pinterest-engineering', kind: 'blog' },
  { name: 'Grafana', url: 'https://grafana.com/blog/index.xml', kind: 'blog' },
  { name: 'Datadog', url: 'https://www.datadoghq.com/blog/engineering/index.xml', kind: 'blog' },
  { name: 'Sentry', url: 'https://blog.sentry.io/feed.xml', kind: 'blog' },
  { name: 'Fly.io', url: 'https://fly.io/blog/feed.xml', kind: 'blog' },
  { name: 'Spotify', url: 'https://engineering.atspotify.com/feed', kind: 'blog' },
  { name: 'Canva', url: 'https://www.canva.dev/blog/engineering/feed.xml', kind: 'blog' },
  { name: 'AWS Architecture', url: 'https://aws.amazon.com/blogs/architecture/feed/', kind: 'blog' },
  { name: 'Google Research', url: 'https://research.google/blog/rss/', kind: 'blog' },
  { name: 'Simon Willison', url: 'https://simonwillison.net/atom/everything/', kind: 'blog' },
  { name: 'The Pragmatic Engineer', url: 'https://newsletter.pragmaticengineer.com/feed', kind: 'blog' },
  // Every URL above was fetched and parsed before being added here. Uber
  // (406 to any non-browser agent), Figma, Dropbox and LinkedIn were dropped
  // for exactly that reason rather than left in to fail silently every Monday.
  // Discord's feed was dropped on inspection: it is the company blog, so it
  // ranks "Link Discord and WoW" alongside engineering write-ups.
]

/**
 * Tech journalism, in article form.
 *
 * Not a headline wire. These three publish explanatory pieces an engineer can
 * finish and argue with, which is the same bar the engineering blogs clear.
 * TechCrunch and The Register were tested and left out on purpose: funding
 * rounds and industry snark are news, but not the kind a guild meets about.
 */
const NEWS_FEEDS: FeedSpec[] = [
  { name: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/technology-lab', kind: 'news' },
  { name: 'InfoQ', url: 'https://feed.infoq.com/', kind: 'news' },
  { name: 'IEEE Spectrum', url: 'https://spectrum.ieee.org/feeds/topic/computing.rss', kind: 'news' },
]

/**
 * Talks and explainers, via YouTube's per-channel Atom feed.
 *
 * `youtube.com/feeds/videos.xml?channel_id=…` is public, keyless and returns
 * the channel's 15 most recent uploads with a thumbnail and view count. No API
 * quota to manage, and the channel list is the curation, exactly as with blogs.
 *
 * Note that youtube.com is blocked for Hacker News submissions further down:
 * a video someone posted to HN is a link into a comment thread, whereas these
 * are the uploads themselves.
 */
const VIDEO_FEEDS: FeedSpec[] = [
  { name: 'Fireship', url: ytFeed('UCsBjURrPoezykLs9EqgamOA'), kind: 'video' },
  { name: 'ByteByteGo', url: ytFeed('UCZgt6AzoyjslHTC9dz0UoTw'), kind: 'video' },
  { name: 'GOTO Conferences', url: ytFeed('UCs_tLP3AiwYKwdUHpltJPuA'), kind: 'video' },
  { name: 'InfoQ', url: ytFeed('UCkQX1tChV7Z7l1LFF4L9j_g'), kind: 'video' },
  { name: 'Computerphile', url: ytFeed('UC9-y-6csu5WGm29I7JiwpnA'), kind: 'video' },
  { name: 'ThePrimeagen', url: ytFeed('UC8ENHE5xdFSwx71u3fDH5Xw'), kind: 'video' },
  { name: 'Two Minute Papers', url: ytFeed('UCbfYPyITQ-7l4upoX8nvctg'), kind: 'video' },
  { name: 'ArjanCodes', url: ytFeed('UCVhQ2NnY5Rskt6UjCUkJ_DA'), kind: 'video' },
]

function ytFeed(channelId: string): string {
  return `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`
}

export interface Candidate {
  source: ByteSource
  /** Stable id from the upstream API, used to dedupe and to match LLM output. */
  source_id: string
  /** The headline exactly as published. No publisher prefix, see source_name. */
  title: string
  /** Publisher or channel: "Cloudflare", "Ars Technica", "Fireship". */
  source_name: string
  url: string
  /** Upvotes / views. Not comparable across sources, see normalize(). */
  points: number
  /** Short excerpt passed to the summarizer for context. */
  excerpt?: string
  /** Still frame, video only. */
  thumbnail?: string
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
 * 3000 HN points and 400000 YouTube views both mean "this did well on its own
 * platform", so each source gets its own reference point and a log curve, which
 * stops one viral item from dominating every bucket.
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
  if (typeof v === 'number') return String(v)
  if (v && typeof v === 'object' && '#text' in v) {
    const t = (v as { '#text': unknown })['#text']
    if (typeof t === 'string') return t
    if (typeof t === 'number') return String(t)
  }
  return undefined
}

/** Atom puts the URL in an attribute; RSS puts it in the element body. */
function linkOf(entry: Record<string, unknown>): string | undefined {
  const direct = firstString(entry.link)
  if (direct?.startsWith('http')) return direct

  // Atom entries often carry several <link rel="…">; the article is `alternate`.
  const links = Array.isArray(entry.link) ? entry.link : [entry.link]
  for (const link of links) {
    if (!link || typeof link !== 'object') continue
    const rec = link as Record<string, unknown>
    const rel = rec['@_rel']
    if (rel && rel !== 'alternate') continue
    const href = rec['@_href']
    if (typeof href === 'string') return href
  }
  return undefined
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
}

function record(value: unknown): Record<string, unknown> | undefined {
  const v = Array.isArray(value) ? value[0] : value
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : undefined
}

/**
 * A YouTube description is mostly sponsor copy, links and socials. Keep only
 * the leading paragraphs that read like prose, so the summarizer is grounded in
 * what the video is about rather than in a discount code.
 */
function cleanVideoDescription(raw: string): string | undefined {
  const kept: string[] = []
  for (const para of raw.split(/\n\s*\n/)) {
    const p = para.trim()
    if (!p) continue
    if (/https?:\/\//.test(p)) continue // sponsor blocks, socials, chapters
    if (/^[#•\-*]/.test(p)) continue // hashtag walls, link lists
    kept.push(p)
    if (kept.join(' ').length > 400) break
  }
  const text = kept.join(' ').replace(/\s+/g, ' ').trim()
  return text ? text.slice(0, 500) : undefined
}

/**
 * Read one RSS/Atom feed into candidates.
 *
 * One failing feed must never take the digest down with it, so a fetch or parse
 * failure returns an empty list rather than throwing.
 */
async function fetchFeed(
  parser: XMLParser,
  feed: FeedSpec,
  sinceMs: number,
  perFeedMax: number,
): Promise<Candidate[]> {
  const xml = await getXml(feed.url)
  if (!xml) return []

  // Feed shapes vary enough between RSS 2.0 and Atom that the parsed tree is
  // genuinely unknown here; it is narrowed by the guards below.
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

  /* Cap per feed, scaled to how big a pool the caller asked for.
     Verified against a live run: Cloudflare alone published 15 of the 23
     articles across all twelve blogs in one week, so an uncapped fetch makes
     the digest one company's newsletter.
     The cap has to scale, though. Feeds are newest-first, so a fixed cap of 3
     returns the same three stories on every refetch, and those are exactly the
     ones already published and about to be filtered out. */
  const out: Candidate[] = []
  for (const item of items) {
    if (out.length >= perFeedMax) break

    const title = firstString(item.title)?.trim()
    const url = linkOf(item)
    if (!title || !url) continue

    // Recency is the only filter a curated feed needs.
    const dateText =
      firstString(item.pubDate) ?? firstString(item.published) ?? firstString(item.updated)
    const published = dateText ? new Date(dateText).getTime() : NaN
    if (Number.isFinite(published) && published < sinceMs) continue

    const candidate =
      feed.kind === 'video'
        ? videoCandidate(feed, item, title, url)
        : articleCandidate(feed, item, title, url)

    if (candidate) out.push(candidate)
  }
  return out
}

function articleCandidate(
  feed: FeedSpec,
  item: Record<string, unknown>,
  title: string,
  url: string,
): Candidate {
  const rawExcerpt =
    firstString(item.description) ??
    firstString(item.summary) ??
    firstString(item['content:encoded'])
  const excerpt = rawExcerpt ? stripHtml(rawExcerpt).slice(0, 500) : undefined

  return {
    source: feed.kind === 'news' ? 'news' : 'blog',
    source_id: `${feed.kind}:${url}`,
    title,
    source_name: feed.name,
    url,
    // Neither carries a public engagement number. They score by kind: being
    // published by an engineering team IS the signal, which is the whole reason
    // for preferring blogs, and news sits a step below because a publication
    // ships on a schedule whether or not it has something to say.
    points: 0,
    excerpt,
    domain: classifyDomain(title, excerpt),
    score: feed.kind === 'news' ? 0.62 : 0.75,
  }
}

/** A YouTube entry: media:group carries the description, thumbnail and views. */
function videoCandidate(
  feed: FeedSpec,
  item: Record<string, unknown>,
  title: string,
  url: string,
): Candidate | null {
  const videoId = firstString(item['yt:videoId'])
  if (!videoId) return null

  // Shorts are a format, not a talk. Nothing under a minute belongs in a digest
  // and the feed gives no duration, so the tag is the only signal available.
  if (/#shorts?\b/i.test(title)) return null

  const group = record(item['media:group'])
  const rawDescription = group ? firstString(group['media:description']) : undefined
  const excerpt = rawDescription ? cleanVideoDescription(rawDescription) : undefined

  const stats = record(record(group?.['media:community'])?.['media:statistics'])
  const views = Number(stats?.['@_views'] ?? 0)

  return {
    source: 'video',
    source_id: `yt:${videoId}`,
    title,
    source_name: feed.name,
    url,
    points: Number.isFinite(views) ? views : 0,
    excerpt,
    // Built from the id rather than read from media:thumbnail: the feed serves
    // these off rotating i1-i4 hosts, and one stable hostname is one entry in
    // next.config's remotePatterns instead of four.
    thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    domain: classifyDomain(title, excerpt),
    // A floor plus a view-count curve. Channel curation is most of the signal;
    // views only order what is already worth watching.
    score: 0.45 + 0.3 * normalize(Number.isFinite(views) ? views : 0, 400_000),
  }
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
 * The one source with a crowd behind it rather than an editor, kept because it
 * is also the only one that catches something significant published somewhere
 * unexpected. It clears a hard gate to earn that: 300 points, and an off-site
 * article URL, since Ask HN and Show HN threads are conversations and pointing
 * the digest at a comment page gives a reader nothing to read.
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
      let publisher = 'Hacker News'
      try {
        publisher = new URL(h.url!).hostname.replace(/^www\./, '')
      } catch {
        /* keep the fallback */
      }
      return {
        source: 'hn' as const,
        source_id: h.objectID,
        title: h.title!,
        // The site that published it, not "Hacker News". HN is where it was
        // found; the reader wants to know who wrote it.
        source_name: publisher,
        url: h.url!,
        points: h.points ?? 0,
        excerpt,
        domain: classifyDomain(h.title!, excerpt),
        score: normalize(h.points ?? 0, 2000),
      }
    })
}

/**
 * Gather candidates across all sources for the last `days` days.
 *
 * Returns the whole deduplicated pool, unranked and unmixed. Selection happens
 * in generate.ts, after already-published items are removed - picking first and
 * filtering second is how a refetch used to produce a digest of three.
 *
 * A source that fails is skipped rather than failing the run, since a digest
 * from three sources beats no digest at all.
 */
export async function fetchCandidates(days = 8, limit = 10): Promise<Candidate[]> {
  const sinceMs = Date.now() - days * 24 * 60 * 60 * 1000
  const sinceUnix = Math.floor(sinceMs / 1000)

  /* Roughly a quarter of the target from any one feed, floored at 3 so a small
     request still gets a usable spread. At the pool sizes generate.ts asks for
     this leaves enough headroom that a refetch still finds unpublished items. */
  const perFeedMax = Math.max(3, Math.ceil(limit / 4))
  const parser = new XMLParser({ ignoreAttributes: false, trimValues: true })

  const feeds = [...BLOG_FEEDS, ...NEWS_FEEDS, ...VIDEO_FEEDS]
  const results = await Promise.all([
    ...feeds.map(feed => fetchFeed(parser, feed, sinceMs, perFeedMax)),
    fetchHN(sinceUnix),
  ])

  // Drop duplicates by URL, keeping the highest scoring copy. The same article
  // frequently lands on both a company blog and HN in the same week.
  const byUrl = new Map<string, Candidate>()
  for (const candidate of results.flat()) {
    const key = candidate.url.replace(/\/+$/, '').toLowerCase()
    const existing = byUrl.get(key)
    if (!existing || candidate.score > existing.score) byUrl.set(key, candidate)
  }

  return [...byUrl.values()]
}
