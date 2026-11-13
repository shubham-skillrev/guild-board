/**
 * An activity's results, as data: one source for every place that draws
 * them (docs/08-meeting-mode-v2.md, Batch 1). The shared screen and the
 * phones draw them with components/meet/Results.tsx (Tailwind); the report
 * image draws the same numbers with lib/meet/reportImage.tsx (next/og, inline
 * styles). So a poll's percentages, its winner, a word's colour and the
 * cloud's rows are worked out once, here.
 *
 * Pure, imports by path only: runs under `node --test`.
 */

import type { ReportActivity } from './report.ts'

// ─── Polls ────────────────────────────────────────────────────────────────

/**
 * Whole-number shares of `counts` that add up to exactly 100 (largest
 * remainder), so the tiles never read 33 + 33 + 33. All zero when nobody
 * voted.
 */
export function sharesOf(counts: number[]): number[] {
  const total = counts.reduce((n, c) => n + Math.max(0, c), 0)
  if (!total) return counts.map(() => 0)
  const exact = counts.map(c => (Math.max(0, c) / total) * 100)
  const out = exact.map(Math.floor)
  let left = 100 - out.reduce((n, p) => n + p, 0)
  const order = exact.map((x, i) => ({ i, rest: x - Math.floor(x) })).sort((a, b) => b.rest - a.rest || a.i - b.i)
  for (const { i } of order) {
    if (left <= 0) break
    if (counts[i] > 0) { out[i]++; left-- }
  }
  return out
}

export interface PollTile {
  /** Option index: its shape and colour (components/meet/tiles.tsx, TILE_HEX). */
  i: number
  label: string
  n: number
  /** Whole-number share, 0-100; the tiles add up to 100. */
  pct: number
  /** Most votes (ties: every one of them). Never with no votes. */
  lead: boolean
  /** This phone's own vote. */
  mine: boolean
}

/** A poll's tiles: every option, its votes, share and whether it leads. */
export function pollTiles(options: string[], counts: number[] | null | undefined, mine: number | null = null): { tiles: PollTile[]; total: number } {
  const c = options.map((_, i) => Math.max(0, Number(counts?.[i] ?? 0) || 0))
  const total = c.reduce((n, x) => n + x, 0)
  const top = total ? Math.max(...c) : -1
  const pcts = sharesOf(c)
  return { total, tiles: options.map((label, i) => ({ i, label, n: c[i], pct: pcts[i], lead: c[i] === top, mine: mine === i })) }
}

/** How wide a tile's soft fill is, in %: nothing at all for 0% (no sliver). */
export function fillWidth(pct: number): number {
  return pct > 0 ? Math.min(100, pct) : 0
}

/** One column when any option is long, else two (three options: three). */
export function pollColumns(options: string[], max = 3): number {
  if (options.some(o => o.length > 22)) return 1
  return options.length === 3 ? Math.min(3, max) : Math.min(2, max)
}

/**
 * The tiles' hues as hex, for the report image (next/og can't read CSS
 * variables). Same order as components/meet/tiles.tsx TILES and the tokens
 * in globals.css: vermillion, indigo, matcha, wisteria.
 */
export const TILE_HEX = [
  { shape: 'triangle', hex: '#B53620', rgb: '181,54,32' },
  { shape: 'diamond', hex: '#2F5FC4', rgb: '47,95,196' },
  { shape: 'circle', hex: '#16774F', rgb: '22,119,79' },
  { shape: 'square', hex: '#6A48B0', rgb: '106,72,176' },
] as const
export const SAFFRON_HEX = '#A34C07'

// ─── Word clouds ──────────────────────────────────────────────────────────

/** The cloud's pastel hues, in order (components/meet/Results.tsx PASTELS): indigo, matcha, wisteria, vermillion. */
export const WORD_TONE_RGB = ['47,95,196', '22,119,79', '106,72,176', '181,54,32'] as const

/** A word's pastel: stable per word, so it keeps its colour as the cloud reflows, and on every screen. */
export function wordToneIndex(word: string): number {
  let h = 0
  for (let i = 0; i < word.length; i++) h = (h * 31 + word.charCodeAt(i)) >>> 0
  return h % WORD_TONE_RGB.length
}

export interface CloudSizes {
  /** Font size of the smallest and the biggest word, px. */
  min: number
  max: number
  /** Gap between pills, px. */
  gap: number
  /** Never shrink below this (the screen); the report passes 0 and grows instead. */
  minScale: number
  /** How full a row may get before another row is added (share of the width). */
  fill?: number
}

export const SCREEN_CLOUD: CloudSizes = { min: 18, max: 64, gap: 14, minScale: 0.5 }
export const PHONE_CLOUD: CloudSizes = { min: 14, max: 34, gap: 8, minScale: 0.4 }
export const REPORT_CLOUD: CloudSizes = { min: 20, max: 40, gap: 10, minScale: 0.4, fill: 1.6 }

/** Below this, the top word isn't "big": two votes for one word shouldn't fill the screen. */
const CLOUD_FLOOR = 5

/**
 * A word's weight, 0..1, on a square-root scale against the top word (or
 * CLOUD_FLOOR, whichever is more), so one early word or a 2-vote leader
 * stays modest and a big room's long tail stays readable.
 */
export function cloudWeight(n: number, top: number): number {
  const span = Math.sqrt(Math.max(top, CLOUD_FLOOR)) - 1
  return Math.min(1, Math.max(0, (Math.sqrt(n) - 1) / span))
}

/** A pill's estimated width at `size` px: the word, 0.6em padding each side, the border, the gap. */
export function pillWidth(word: string, size: number, gap: number): number {
  return word.length * size * 0.56 + size * 1.2 + gap
}

/** A row's height at `size` px (its biggest word), the gap included. */
export function rowHeight(size: number, gap: number): number {
  return size * 1.5 + gap
}

/**
 * The words as rows, laid out by hand rather than left to flex-wrap: the
 * biggest word goes in the middle row, the next ones alternate above and
 * below, and every word after that joins the shortest row; within a row the
 * biggest sit in the centre. So the cloud is heaviest in the middle and no
 * row is all small words. Fonts shrink together if the rows would overflow
 * `width` or `height` (height 0: no limit). `height` (out) is what the rows
 * take at `scale`, so a renderer that can grow (the report) never clips.
 */
export function cloudRows<T extends { word: string; n: number }>(
  words: T[],
  width: number,
  height: number,
  sizes: CloudSizes = SCREEN_CLOUD,
): { rows: { w: T; size: number }[][]; scale: number; height: number } {
  if (!words.length) return { rows: [], scale: 1, height: 0 }
  const top = words[0]?.n ?? 1
  const sized = words.map(w => ({ w, size: sizes.min + (sizes.max - sizes.min) * cloudWeight(w.n, top) }))
  const est = (x: { w: T; size: number }) => pillWidth(x.w.word, x.size, sizes.gap)
  const total = sized.reduce((s, x) => s + est(x), 0)
  let count = Math.max(1, Math.min(7, Math.ceil(total / (width * (sizes.fill ?? 0.8)))))
  if (count > 1 && count % 2 === 0) count += 1
  count = Math.min(count, sized.length)
  // Centre out: middle row first, then above, below, above...
  const mid = Math.floor(count / 2)
  const order = [mid, ...Array.from({ length: count - 1 }, (_, i) => (i % 2 === 0 ? mid - 1 - Math.floor(i / 2) : mid + 1 + Math.floor(i / 2)))].filter(r => r >= 0 && r < count)
  const rows: { w: T; size: number }[][] = Array.from({ length: count }, () => [])
  const widths = Array(count).fill(0)
  sized.forEach((x, i) => {
    const r = i < order.length ? order[i] : order.reduce((best, r) => (widths[r] < widths[best] ? r : best), order[0])
    rows[r].push(x)
    widths[r] += est(x)
  })
  // Within a row, biggest in the middle.
  const centred = rows
    .map(row => {
      const out: typeof row = []
      row.forEach((x, i) => (i % 2 === 0 ? out.push(x) : out.unshift(x)))
      return out
    })
    .filter(row => row.length)
  // Overflow: shrink everything by the worst of width and height.
  const rowH = centred.map(row => rowHeight(Math.max(sizes.min, ...row.map(x => x.size)), sizes.gap))
  const tallest = rowH.reduce((a, b) => a + b, 0)
  const widest = Math.max(...widths)
  const fit = Math.min(1, height > 0 ? height / tallest : 1, width > 0 ? (width * 0.98) / widest : 1)
  const scale = Math.max(sizes.minScale, fit)
  return { rows: centred, scale, height: Math.ceil(tallest * scale) }
}

// ─── The report image's grid ──────────────────────────────────────────────

export const REPORT_WIDTH = 1200
/** The image's side padding, and the gap between cards. */
export const REPORT_PAD = 64
export const REPORT_GAP = 24
/** A half-width card, and a full-width one (an odd card out). */
export const REPORT_HALF = (REPORT_WIDTH - REPORT_PAD * 2 - REPORT_GAP) / 2
export const REPORT_FULL = REPORT_WIDTH - REPORT_PAD * 2
/** A card's padding, sides. */
export const CARD_PAD_X = 28
/** A card's chrome: padding, eyebrow, a two-line title, the footer. */
const CARD_CHROME = 24 + 20 + 10 + 64 + 18 + 30 + 24
const CARD_MIN = 280
export const REPORT_TILE_H = 76
export const REPORT_TILE_GAP = 10
/** The most activity cards an image shows. */
export const REPORT_CARDS = 6

/** What a card's body needs, in px, at `width`. */
export function reportBodyHeight(a: ReportActivity, width: number): number {
  if (a.empty) return 40
  if (a.kind === 'poll') {
    const labels = (a.options ?? []).map(o => o.label)
    const cols = width > REPORT_HALF ? Math.min(labels.length || 1, 4) : pollColumns(labels, 2)
    const rows = Math.ceil(labels.length / Math.max(1, cols))
    return rows * REPORT_TILE_H + Math.max(0, rows - 1) * REPORT_TILE_GAP
  }
  if (a.kind === 'cloud') return reportCloud(a.words ?? [], width - CARD_PAD_X * 2).height
  return 90
}

/**
 * The report's cloud in a card's inner `width`: never shrunk to fit a
 * height (the card grows instead), with some room to spare on the width
 * because the image's font isn't the one the estimate assumes.
 */
export function reportCloud<T extends { word: string; n: number }>(words: T[], width: number) {
  return cloudRows(words, width * 0.9, 0, REPORT_CLOUD)
}

export interface ReportCardBox {
  /** Index into the activities. */
  index: number
  width: number
}

/**
 * The cards as rows of two, every card in a row as tall as the tallest one
 * needs (nothing clipped), and an odd card out spanning the whole row (no
 * empty cell beside it).
 */
export function reportGrid(acts: ReportActivity[]): { rows: { cards: ReportCardBox[]; height: number }[]; height: number } {
  const shown = acts.slice(0, REPORT_CARDS)
  const rows: { cards: ReportCardBox[]; height: number }[] = []
  for (let i = 0; i < shown.length; i += 2) {
    const pair = i + 1 < shown.length
    const width = pair ? REPORT_HALF : REPORT_FULL
    const cards = (pair ? [i, i + 1] : [i]).map(index => ({ index, width }))
    const height = Math.max(CARD_MIN, ...cards.map(c => CARD_CHROME + reportBodyHeight(shown[c.index], width)))
    rows.push({ cards, height })
  }
  const height = rows.reduce((n, r) => n + r.height, 0) + Math.max(0, rows.length - 1) * REPORT_GAP
  return { rows, height }
}

/** The image's size: the header, the grid, the rating strip. Never shorter than square. */
export function reportImageSize(acts: ReportActivity[], rating: boolean): { width: number; height: number } {
  const grid = reportGrid(acts).height || 60
  return { width: REPORT_WIDTH, height: Math.max(1200, Math.ceil(56 + 420 + 28 + grid + (rating ? 230 : 0) + 56)) }
}
