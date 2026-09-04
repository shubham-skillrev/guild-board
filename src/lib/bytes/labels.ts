/**
 * How a byte describes itself in the UI.
 *
 * What the item *is*, not where we found it. A reader does not care that a
 * piece surfaced through the Hacker News API; they care whether it is an
 * article, a report or a talk, because that decides whether they have time for
 * it now.
 *
 * Third copy of this table is why it is a module: the card, the board teaser
 * and the reader all label the same rows, and they had already drifted.
 */

export const MEDIUM_LABELS: Record<string, string> = {
  blog: 'Article',
  hn: 'Article',
  news: 'News',
  video: 'Video',
  // Retired sources, still present in older digests.
  github: 'Repo',
  lobsters: 'Article',
  devto: 'Article',
}

/** Units differ per source, and an unlabelled 405,801 next to a 312 is noise. */
export const POINT_LABELS: Record<string, string> = {
  hn: 'points',
  video: 'views',
  github: 'stars',
}

export function mediumLabel(source: string): string {
  return MEDIUM_LABELS[source] ?? source
}

export function compactCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, '')}K`
  return String(n)
}

/**
 * Does this row open in the app, or at the publisher?
 *
 * The answer is not a property of the source but of the individual item: two
 * Cloudflare posts can differ if one feed entry was truncated. `reading_minutes`
 * is written exactly when a body was, so it doubles as the flag - and it is a
 * smallint, which means the digest list can ask this question without pulling
 * a quarter of a megabyte of article bodies down to render ten link rows.
 */
export function hasReaderPage(byte: { reading_minutes?: number | null }): boolean {
  return byte.reading_minutes != null
}
