'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils/cn'
import type { PublicActivity } from '@/lib/meet/activity'
import { cloudRows, fillWidth, PHONE_CLOUD, pollColumns, pollTiles, SCREEN_CLOUD, wordToneIndex } from '@/lib/meet/results'
import { OptionShape, tileFor } from '@/components/meet/tiles'

/**
 * Results, drawn the same on the shared screen and on every phone
 * (docs/08-meeting-mode-v2.md, Batch 1). The numbers come from
 * lib/meet/results.ts, which the report image (lib/meet/reportImage.tsx)
 * draws too, so all three agree.
 *
 *   PollResultTiles  the voting tiles: each with its % big, a soft fill to
 *                    that level (none at 0%), the winner ringed in saffron
 *                    once the poll has closed, the phone's own "you picked"
 *   WordCloud        the pastel pills, biggest in the middle row
 */

const EASE = 'ease-[cubic-bezier(0.23,1,0.32,1)]'

/**
 * Soft colour, one hue per cloud word: the guild's own tokens at low alpha
 * (lib/meet/results.ts WORD_TONE_RGB, in the same order). Full class strings
 * (Tailwind scans them).
 */
const PASTELS = [
  { pill: 'bg-indigo-jp/[0.09] border-indigo-jp/20', top: 'bg-indigo-jp/[0.2] border-indigo-jp/45' },
  { pill: 'bg-matcha/[0.09] border-matcha/20', top: 'bg-matcha/[0.2] border-matcha/45' },
  { pill: 'bg-wisteria/[0.09] border-wisteria/20', top: 'bg-wisteria/[0.2] border-wisteria/45' },
  { pill: 'bg-vermillion/[0.07] border-vermillion/20', top: 'bg-vermillion/[0.16] border-vermillion/40' },
] as const

export const wordTone = (word: string) => PASTELS[wordToneIndex(word)]

/**
 * A poll's tiles with their results. `shown` false hides the numbers (the
 * screen's first 8 s); `final` rings the winner (closed). `mine` marks the
 * phone's own vote.
 */
export function PollResultTiles({
  activity,
  size,
  shown = true,
  final = activity.status === 'closed',
  mine = null,
  correct = null,
}: {
  activity: Pick<PublicActivity, 'options' | 'counts' | 'status'>
  size: 'screen' | 'phone'
  shown?: boolean
  final?: boolean
  mine?: number | null
  /** A Boss Round predict stage: the right tile, ringed instead of the most picked. */
  correct?: number | null
}) {
  const screen = size === 'screen'
  const { tiles } = pollTiles(activity.options, activity.counts, mine)
  const cols = pollColumns(activity.options, screen ? 3 : 2)
  // The fills grow in from nothing once, on arrival.
  const [armed, setArmed] = useState(false)
  useEffect(() => {
    const id = requestAnimationFrame(() => setArmed(true))
    return () => cancelAnimationFrame(id)
  }, [])
  return (
    <ul className={cn('grid', screen ? 'gap-4' : 'gap-2.5')} style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
      {tiles.map(t => {
        const tile = tileFor(t.i)
        const quiz = correct !== null
        const ring = final && shown && (quiz ? t.i === correct : t.lead)
        const strong = quiz ? t.i === correct : t.lead
        return (
          <li
            key={t.i}
            className={cn(
              'relative overflow-hidden border transition-[box-shadow,border-color] duration-500',
              screen ? 'rounded-(--radius-card)' : 'rounded-[16px] border-2',
              tile.tile,
              ring && 'border-saffron ring-2 ring-saffron',
            )}
          >
            {/* The share fills the tile from the left, in its own colour. 0%: no fill at all. */}
            {shown && fillWidth(t.pct) > 0 && (
              <span
                aria-hidden
                className={cn('absolute inset-y-0 left-0 transition-[width] duration-[900ms] motion-reduce:transition-none', EASE, tile.fill)}
                style={{ width: `${armed ? fillWidth(t.pct) : 0}%` }}
              />
            )}
            <span className={cn('relative flex items-center', screen ? cn('gap-5 px-7', cols === 3 ? 'min-h-[132px]' : 'min-h-[104px]') : 'min-h-16 gap-3 px-4 py-3')}>
              <OptionShape i={t.i} size={screen ? 34 : 22} />
              <span className="min-w-0 flex-1">
                <span className={cn('block font-medium leading-snug text-ink text-balance', screen ? 'text-[clamp(21px,1.35vw,26px)] tracking-[-0.015em]' : 'text-[15px]')}>{t.label}</span>
                {(t.mine || (ring && quiz)) && (
                  <span className={cn('mt-0.5 block font-mono uppercase tracking-[0.14em] text-ink-muted', screen ? 'text-[12px]' : 'text-[10.5px]')}>
                    {[ring && quiz ? 'right answer' : '', t.mine ? 'you picked' : ''].filter(Boolean).join(' · ')}
                  </span>
                )}
              </span>
              <span
                className={cn(
                  'num shrink-0 tracking-[-0.03em] transition-opacity duration-500',
                  screen ? 'text-[clamp(28px,2vw,40px)]' : 'text-[24px]',
                  shown ? 'opacity-100' : 'opacity-0',
                  strong && shown ? 'font-semibold text-ink' : 'text-ink-soft',
                )}
              >
                {t.pct}%
              </span>
            </span>
            {ring && !quiz && <span className="sr-only">Most votes</span>}
          </li>
        )
      })}
    </ul>
  )
}

/**
 * The word cloud: rows laid out by lib/meet/results.ts cloudRows, the
 * biggest word in the middle, each word in its own pastel. The same on the
 * screen and on a phone, just smaller there.
 */
export function WordCloud({ activity, size = 'screen', onPick }: { activity: Pick<PublicActivity, 'words'>; size?: 'screen' | 'phone'; /** The presenter's moderation: tapping a word hides it. */ onPick?: (word: string) => void }) {
  const words = activity.words ?? []
  const screen = size === 'screen'
  const sizes = screen ? SCREEN_CLOUD : PHONE_CLOUD
  const box = useRef<HTMLDivElement>(null)
  const [dim, setDim] = useState(screen ? { w: 1600, h: 480 } : { w: 360, h: 0 })
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setDim({ w: e.contentRect.width, h: screen ? e.contentRect.height : 0 }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [screen])

  if (!words.length) {
    return (
      <div ref={box} className={cn('flex items-center justify-center', screen ? 'min-h-0 flex-1' : 'py-6')}>
        <p className={cn('text-ink-muted', screen ? 'text-[20px]' : 'text-footnote')}>{screen ? 'Waiting for the first word…' : 'No words this time.'}</p>
      </div>
    )
  }
  const { rows, scale } = cloudRows(words, dim.w, dim.h, sizes)
  const leader = words[0]
  // One list, rows split by full-width breaks: a word that changes row moves
  // rather than re-mounting, so only a new word plays its landing.
  return (
    <div ref={box} className={cn('flex flex-col justify-center', screen ? 'min-h-0 flex-1 overflow-hidden' : 'w-full')}>
      <ul aria-label={screen ? 'Words so far' : 'Words'} className={cn('flex flex-wrap items-center justify-center', screen ? 'gap-3' : 'gap-2')}>
        {rows.flatMap((row, r) => [
          ...(r > 0 ? [<li key={`row-${r}`} aria-hidden className="h-0 basis-full" />] : []),
          ...row.map(({ w, size: px }) => {
            const weight = (px - sizes.min) / (sizes.max - sizes.min)
            const top = w.word === leader.word && leader.n > 1
            const tone = wordTone(w.word)
            return (
              <li
                key={w.word}
                className={cn(
                  'gb-word-land whitespace-nowrap rounded-full border px-[0.6em] py-[0.14em] leading-[1.15] tracking-[-0.02em] transition-[font-size,background-color,color,border-color] duration-700 motion-reduce:transition-none',
                  EASE,
                  top
                    ? cn(tone.top, 'font-semibold text-ink')
                    : weight > 0.45
                      ? cn(tone.pill, 'font-semibold text-ink')
                      : weight > 0.15
                        ? cn(tone.pill, 'font-medium text-ink')
                        : cn(tone.pill, 'text-ink-soft'),
                )}
                style={{ fontSize: `${Math.round(px * scale)}px` }}
              >
                {onPick ? (
                  <button type="button" onClick={() => onPick(w.word)} title="Hide this word" className="cursor-pointer decoration-ink-muted/70 decoration-2 hover:line-through focus-visible:line-through">
                    {w.word}
                    <span className="sr-only">{w.n > 1 ? ` (${w.n})` : ''}, hide it</span>
                  </button>
                ) : (
                  <>
                    {w.word}
                    {w.n > 1 && <span className="sr-only"> ({w.n})</span>}
                  </>
                )}
              </li>
            )
          }),
        ])}
      </ul>
    </div>
  )
}
