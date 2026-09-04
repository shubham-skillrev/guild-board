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

/** Sources whose body can be transcribed. A repo has no article behind it. */
export const READABLE_SOURCES = new Set(['blog', 'news', 'hn', 'lobsters', 'devto'])

export function mediumLabel(source: string): string {
  return MEDIUM_LABELS[source] ?? source
}

export function compactCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, '')}K`
  return String(n)
}

/**
 * The reader is only worth linking to when there is something to read there.
 * A video opens its own page too - the embed plus the summary is a real page -
 * but a retired GitHub row is a name and a star count, so it keeps linking out.
 */
export function hasReaderPage(source: string): boolean {
  return READABLE_SOURCES.has(source) || source === 'video'
}

/** `yt:dQw4w9WgXcQ` -> `dQw4w9WgXcQ`. Null for anything that is not a video. */
export function youtubeId(source: string, sourceId: string): string | null {
  if (source !== 'video') return null
  const id = sourceId.startsWith('yt:') ? sourceId.slice(3) : sourceId
  // The feed only ever yields the 11-character form; anything else is an old
  // row and is safer left un-embedded than interpolated into an iframe src.
  return /^[\w-]{11}$/.test(id) ? id : null
}
