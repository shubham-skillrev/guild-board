import 'server-only'
import sanitizeHtml from 'sanitize-html'

/**
 * Feed article bodies: measuring them, and taking what is useful out of them.
 *
 * ── The integrity contract, same as summarize.ts ─────────────────────────
 * Nothing here is model-generated. A body is the publisher's own HTML, taken
 * verbatim from the feed element they put it in. It is never shown: GuildBoard
 * has no licence to republish it (migration 039). It is read once, for the
 * summarizer's context, the read time, and the links inside it, then dropped.
 */

/** Shorter than this and the feed gave a teaser, not an article. */
const MIN_BODY_CHARS = 3_000
/** Beyond this a reader wants the original anyway, and the row gets huge. */
const MAX_BODY_CHARS = 400_000
const WORDS_PER_MINUTE = 225

/** Rough word count off the markup, for the read-time badge. */
export function readingMinutes(html: string): number {
  const text = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()
  const words = text.split(' ').filter(Boolean).length
  return Math.min(120, Math.max(1, Math.round(words / WORDS_PER_MINUTE)))
}

/**
 * Decide whether a feed handed us a whole article or just a teaser.
 *
 * Returns null when it is a teaser, which is the signal for the row to keep
 * its outbound link. Length is the only usable test: feeds do not declare
 * whether their content element is complete, and the two shapes are otherwise
 * identical markup.
 */
export function usableArticleBody(html: string | undefined): string | null {
  if (!html) return null
  const trimmed = html.trim()
  if (trimmed.length < MIN_BODY_CHARS) return null
  return trimmed.slice(0, MAX_BODY_CHARS)
}

/* ─── Resources: the links a publisher put in their own piece ─────────────
   A byte page no longer shows the article (no licence to republish it), but
   the links inside it are often the most useful part: the repo, the docs,
   the paper. These are taken verbatim from the publisher's markup, never
   from the model, the same rule as titles and URLs. */

export interface Resource {
  title: string
  url: string
}

const MAX_RESOURCES = 6

/* Sharing buttons, social profiles and link shorteners: never a resource. */
const SKIP_HOST = /(^|\.)(twitter\.com|x\.com|facebook\.com|linkedin\.com|instagram\.com|threads\.net|bsky\.app|mastodon\.social|reddit\.com|t\.co|bit\.ly|buff\.ly|lnkd\.in|feedburner\.com|patreon\.com|discord\.gg|news\.google\.com)$/i
/* The publisher's own furniture: tag pages, authors, newsletters, careers. */
const SKIP_PATH = /\/(tag|tags|category|categories|author|authors|subscribe|newsletter|about|careers|jobs|privacy|terms|contact|login|signup|share)(\/|$)/i
/* Worth surfacing first: code, docs, papers, specs. */
const PREFER_HOST = /(^|\.)(github\.com|gitlab\.com|arxiv\.org|huggingface\.co|npmjs\.com|pypi\.org|crates\.io|docs\.[a-z.]+|developer\.[a-z.]+|rfc-editor\.org|w3\.org|youtube\.com)$/i
/* Anchor text that says nothing on its own. */
const VAGUE_TEXT = /^(here|this|link|source|read more|more|click here|this post|this article|the post|website|site)$/i

function normalizeUrl(raw: string): URL | null {
  try {
    const u = new URL(raw)
    if (u.protocol !== 'https:') return null
    u.hash = ''
    for (const key of [...u.searchParams.keys()]) {
      if (/^(utm_|ref$|ref_src$|fbclid$|gclid$)/i.test(key)) u.searchParams.delete(key)
    }
    return u
  } catch {
    return null
  }
}

function sameTarget(a: URL, b: URL): boolean {
  const strip = (u: URL) => `${u.host}${u.pathname.replace(/\/+$/, '')}${u.search}`
  return strip(a) === strip(b)
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
}

/**
 * Up to six useful links out of a feed item's HTML, code and docs first,
 * then in reading order. Skips the article's own URL, sharing and social
 * links, the publisher's tag/author/newsletter pages, homepages, and
 * anything not https.
 */
export function resourcesFrom(html: string | null | undefined, articleUrl: string): Resource[] {
  if (!html) return []
  const article = normalizeUrl(articleUrl)
  const found: { r: Resource; preferred: boolean; order: number }[] = []
  const seen = new Set<string>()

  sanitizeHtml(html, {
    allowedTags: ['a'],
    allowedAttributes: { a: ['href'] },
    exclusiveFilter: frame => {
      if (frame.tag !== 'a') return false
      const u = normalizeUrl(String(frame.attribs.href ?? ''))
      if (!u || SKIP_HOST.test(u.hostname) || SKIP_PATH.test(u.pathname)) return false
      if (u.pathname === '/' && !u.search) return false
      if (article && sameTarget(u, article)) return false
      const key = `${u.host}${u.pathname.replace(/\/+$/, '')}${u.search}`
      if (seen.has(key)) return false
      seen.add(key)

      const text = decodeEntities(frame.text ?? '').replace(/\s+/g, ' ').trim()
      const fallback = `${u.hostname.replace(/^www\./, '')}${u.pathname.replace(/\/+$/, '')}`
      const title = !text || VAGUE_TEXT.test(text) || /^https?:\/\//.test(text) ? fallback : text
      found.push({ r: { title: title.slice(0, 120), url: u.toString() }, preferred: PREFER_HOST.test(u.hostname), order: found.length })
      return false
    },
  })

  return found
    .sort((a, b) => Number(b.preferred) - Number(a.preferred) || a.order - b.order)
    .slice(0, MAX_RESOURCES)
    .map(f => f.r)
}

/** Plain text of a feed item, for the summarizer only. Never displayed. */
export function articleText(html: string | null | undefined, max = 2_500): string | undefined {
  if (!html) return undefined
  const text = decodeEntities(sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })).replace(/\s+/g, ' ').trim()
  return text ? text.slice(0, max) : undefined
}
