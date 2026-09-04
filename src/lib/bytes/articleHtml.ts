import 'server-only'
import sanitizeHtml from 'sanitize-html'

/**
 * Feed article bodies: measuring them, and making them safe to render.
 *
 * ── The integrity contract, same as summarize.ts ─────────────────────────
 * Nothing here is model-generated. A body is the publisher's own HTML, taken
 * verbatim from the feed element they put it in. The summarizer writes prose
 * *about* an item; this is what the item actually says. The two never mix, and
 * the reader labels them separately.
 *
 * ── Why sanitize on read rather than on write ────────────────────────────
 * Feed HTML is third-party input and goes into the DOM via
 * dangerouslySetInnerHTML, so it has to be filtered or it is a stored-XSS hole
 * with a scheduled job politely populating it twice a week.
 *
 * Filtering happens when the body is served, not when it is stored. Storing
 * the raw element means a hole found in the allowlist below is closed by
 * editing this file - every existing row is re-filtered on its next read.
 * Sanitizing on write would bake today's allowlist into the table and leave
 * every row already in it holding whatever that version let through.
 */

/** Shorter than this and the feed gave a teaser, not an article. */
const MIN_BODY_CHARS = 3_000
/** Beyond this a reader wants the original anyway, and the row gets huge. */
const MAX_BODY_CHARS = 400_000
const WORDS_PER_MINUTE = 225

/**
 * What a syndicated article is allowed to contain.
 *
 * Structure, emphasis, links, code, tables and images. No <script>, no
 * <iframe>, no <style>, no event handlers, and no `srcset` - sanitize-html
 * drops every attribute not named here, which is why the list is written as
 * what is permitted rather than what is blocked.
 */
const POLICY: sanitizeHtml.IOptions = {
  allowedTags: [
    'p', 'br', 'hr',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup', 'mark', 'small',
    'ul', 'ol', 'li', 'dl', 'dt', 'dd',
    'blockquote', 'q', 'cite',
    'pre', 'code', 'kbd', 'samp', 'var',
    'a', 'img', 'figure', 'figcaption',
    'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption',
    'span', 'div',
  ],
  allowedAttributes: {
    // target and rel are here because transformTags below sets them; an
    // attribute the transform adds is still dropped if it is not permitted.
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    // Highlighted code blocks carry their language as a class, and dropping it
    // turns every snippet into undifferentiated grey text.
    code: ['class'],
    pre: ['class'],
    th: ['colspan', 'rowspan', 'scope'],
    td: ['colspan', 'rowspan'],
  },
  // http is absent on purpose: a mixed-content image is a broken image, and a
  // plaintext link out of an authenticated page is worse than no link.
  allowedSchemes: ['https', 'mailto'],
  allowedSchemesByTag: { img: ['https', 'data'] },
  // Every link leaves the app. Opening in place would strand the reader in a
  // publisher's site inside what is otherwise a tab of the guild board.
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', {
      target: '_blank',
      rel: 'noopener noreferrer nofollow',
    }),
  },
  // Drop the contents too, rather than leaving stylesheet text as a paragraph.
  nonTextTags: ['style', 'script', 'textarea', 'option', 'noscript'],
}

/** Filter a stored body for rendering. Never skip this on the way to the DOM. */
export function sanitizeArticleHtml(html: string): string {
  return sanitizeHtml(html, POLICY)
}

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
