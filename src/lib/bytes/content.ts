import 'server-only'

/**
 * Get the readable body of an article.
 *
 * ── Why a body at all ────────────────────────────────────────────────────
 * A byte was a link out, and a link out is where the reader stops being in the
 * app. The upvote - the only signal the digest collects - lives here, so the
 * article has to live here too.
 *
 * ── The integrity contract, same as summarize.ts ─────────────────────────
 * Nothing in this file is model-generated. `content_md` is a transcription of
 * the publisher's own page, and the reader renders it under the publisher's
 * name with a link to the original. The summarizer writes prose *about* an
 * item; this writes down what the item actually says. The two never mix.
 *
 * ── Why r.jina.ai ────────────────────────────────────────────────────────
 * Free, keyless, and it returns markdown rather than a DOM to clean up. The
 * alternative was to write an extractor: boilerplate stripping, paywall
 * detection and per-publisher quirks, which is a project rather than a
 * function. The unauthenticated tier is rate limited (roughly 20 requests a
 * minute), which is why extraction is lazy and cached rather than run for
 * every item of every digest.
 */

/** Anything shorter than this is a paywall stub or a cookie wall, not a piece. */
const MIN_CHARS = 600
/** Postgres will take more, but a reader who needs 60k characters wants the original. */
const MAX_CHARS = 60_000
const WORDS_PER_MINUTE = 225

export interface Extracted {
  markdown: string
  source: 'feed' | 'reader'
  readingMinutes: number
}

/** Jina prefixes the body with `Title:`/`URL Source:`/`Markdown Content:` lines. */
function stripReaderPreamble(raw: string): string {
  const marker = raw.indexOf('Markdown Content:')
  const body = marker === -1 ? raw : raw.slice(marker + 'Markdown Content:'.length)
  return body.trim()
}

/**
 * Strip the furniture the extractor cannot tell from prose.
 *
 * Every rule here was written against a real body, not guessed. Medium-hosted
 * blogs - Netflix, Airbnb, Pinterest, three of the strongest feeds in the list
 * - open every article with an empty byline link and a pair of bare `--`
 * lines, which are the clap and response counters. Rendered as-is they put two
 * stray dashes above the first paragraph of every Netflix post.
 */
function stripJunk(md: string): string {
  return md
    // Bare image links with no alt text: almost always a pixel or a divider.
    .replace(/^!\[\]\([^)]*\)\s*$/gm, '')
    // Jina emits base64 data URIs for inline SVGs, which are enormous and
    // are icons rather than illustrations.
    .replace(/!\[[^\]]*\]\(data:[^)]*\)/g, '')
    // An empty link is a wrapper around an avatar the extractor already
    // dropped. Nothing to click and nothing to read.
    .replace(/^\[\]\([^)]*\)\s*$/gm, '')
    // Medium's clap and response counters. Two dashes, not three, so this is
    // never a horizontal rule.
    .replace(/^--\s*$/gm, '')
    // The publisher's own estimate, when it leads the body. The page renders
    // its own reading time in the header and two disagree eventually.
    .replace(/^\s*\d+\s+min read\s*$/gim, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export function readingMinutes(markdown: string): number {
  const words = markdown.split(/\s+/).filter(Boolean).length
  return Math.min(120, Math.max(1, Math.round(words / WORDS_PER_MINUTE)))
}

/**
 * Fetch and transcribe one article.
 *
 * Returns null rather than throwing on every failure path, because a body that
 * could not be extracted is a normal outcome - paywalls, logins and JS-only
 * pages all end here - and the reader falls back to the summary and a link.
 */
export async function extractArticle(url: string, timeoutMs = 25_000): Promise<Extracted | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const res = await fetch(`https://r.jina.ai/${url}`, {
      headers: {
        'User-Agent': 'guildboard-bytes/1.0',
        Accept: 'text/plain',
        /* Ask for the article only. Without this the extractor returns the nav,
           the footer and the cookie banner as prose. */
        'X-Target-Selector': 'article, main',
        'X-Retain-Images': 'none',
      },
      signal: controller.signal,
      cache: 'no-store',
    })

    if (!res.ok) {
      console.warn(`bytes/content: reader returned ${res.status} for ${url}`)
      return null
    }

    const markdown = stripJunk(stripReaderPreamble(await res.text())).slice(0, MAX_CHARS)

    // A stub is worse than nothing: it looks like the article, ends after two
    // sentences, and the reader assumes the feature is broken rather than that
    // the publisher has a paywall.
    if (markdown.length < MIN_CHARS) {
      console.warn(`bytes/content: only ${markdown.length} chars for ${url}, treating as unreadable`)
      return null
    }

    return { markdown, source: 'reader', readingMinutes: readingMinutes(markdown) }
  } catch (err) {
    console.warn(`bytes/content: extraction failed for ${url}`, err)
    return null
  } finally {
    clearTimeout(timer)
  }
}
