'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Play } from '@phosphor-icons/react/dist/ssr'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'
import { pollRevealed, type ActivityKind, type PublicActivity } from '@/lib/meet/activity'
import { bossProblem, bossVerdict } from '@/lib/meet/boss'
import { KIND_LABELS, type MeetingState, type Segment } from '@/lib/meeting'

const KIND_NAME: Record<ActivityKind, string> = { poll: 'Poll', cloud: 'Word cloud', boss: 'Boss Round' }
const EASE = 'ease-[cubic-bezier(0.22,1,0.36,1)]'

type Call = (action: string, payload?: Record<string, unknown>, done?: string) => Promise<unknown>

/** The segment's activity, if it has one (any status). */
export function segmentActivity(state: MeetingState, segment: Segment): PublicActivity | null {
  const a = state.room?.activity
  return a && a.segmentId === segment.id ? a : null
}

/**
 * An activity that hasn't opened yet, as a quiet strip under the segment:
 * what the room will be asked, and for the presenter the one "Open" button
 * (the screen's single saffron action).
 */
export function ActivityReady({
  activity,
  presenting,
  call,
  busy,
}: {
  activity: PublicActivity
  presenting: boolean
  call: Call
  busy: string | null
}) {
  const name = KIND_NAME[activity.kind]
  const problem = activity.kind === 'boss' ? bossProblem(activity.config) : null
  return (
    <section aria-label={name} className="flex max-w-[64rem] items-center gap-8 rounded-[24px] border border-border bg-paper px-7 py-6">
      <div className="min-w-0 flex-1">
        <p className="font-mono text-[13px] uppercase tracking-[0.18em] text-ink-muted">{name} · on everyone’s phone once it opens</p>
        <p className="mt-2 text-[clamp(22px,1.6vw,30px)] font-medium leading-snug tracking-[-0.015em] text-ink text-balance">{activity.prompt}</p>
        {problem && <p className="mt-1.5 text-[17px] text-ink-muted">Code runs on their own devices; only pass or fail comes back.</p>}
      </div>
      {presenting ? (
        <Button icon={Play} disabled={!!busy} onClick={() => call('open_activity', { activity_id: activity.id })} className="shrink-0">
          {busy === 'open_activity' ? 'Opening…' : `Open the ${name.toLowerCase()}`}
        </Button>
      ) : (
        <p className="shrink-0 text-footnote text-ink-muted">Opens soon</p>
      )}
    </section>
  )
}

/**
 * An open or closed activity, as the hero of the presenter screen
 * (docs/06-meeting-mode.md): the question large, then the answers as they
 * come in: poll bars (hidden for the first 8 s, so the first votes don't
 * steer the rest), the word cloud (live from the start), or the Boss Round's
 * pass rate. Closed, it shows the final result; the presenter may open it
 * again. The Boss Round has no clock: it runs until the presenter closes it,
 * and Kers' verdict shows once it's closed.
 *
 * Moving to another segment closes it (the API does). Everything here is
 * counts, words and rates: nothing names anyone.
 */
export function ActivityHero({
  segment,
  activity: a,
  participants,
  presenting,
  now,
  call,
  busy,
}: {
  segment: Segment
  activity: PublicActivity
  participants: number
  presenting: boolean
  now: () => number
  call: Call
  busy: string | null
}) {
  const t = useTicking(a.status === 'open' && a.kind === 'poll', now)
  const open = a.status === 'open'
  const status = open ? `${a.answered} of ${participants} ${a.kind === 'boss' ? 'trying' : 'answered'}` : `closed · ${a.answered} ${a.kind === 'boss' ? 'tried' : 'answered'}`
  const problem = a.kind === 'boss' ? bossProblem(a.config) : null

  return (
    <section aria-label={KIND_NAME[a.kind]} className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-8 items-center gap-3">
        <p className="font-mono text-[14px] uppercase tracking-[0.18em] text-ink-muted">
          {KIND_LABELS[segment.kind] === KIND_NAME[a.kind] ? KIND_NAME[a.kind] : `${KIND_LABELS[segment.kind]} · ${KIND_NAME[a.kind]}`} · <span className="tabular">{status}</span>
        </p>
        {presenting && (
          <div className="ml-auto opacity-60 transition-opacity duration-200 hover:opacity-100 focus-within:opacity-100">
            {open ? (
              <Button variant="ghost" disabled={!!busy} onClick={() => call('close_activity', { activity_id: a.id })}>
                {a.kind === 'boss' ? 'Close the round' : 'Close'}
              </Button>
            ) : (
              <Button variant="ghost" disabled={!!busy} onClick={() => call('open_activity', { activity_id: a.id })}>Open again</Button>
            )}
          </div>
        )}
      </div>
      <h1 className="mt-4 max-w-[30ch] text-[clamp(40px,3.4vw,64px)] font-semibold leading-[1.06] tracking-[-0.03em] text-ink text-balance">{a.prompt}</h1>
      {problem ? (
        <p className="mt-4 max-w-[64ch] text-[clamp(18px,1.25vw,22px)] leading-relaxed text-ink-soft">
          {problem.description} <span className="whitespace-nowrap font-mono text-ink">{problem.signature}</span>
          <span className="text-ink-muted"> · {problem.cases.length} tests</span>
        </p>
      ) : open ? (
        <p className="mt-3 text-[17px] text-ink-muted">On your phone or laptop: open GuildBoard and join the room.</p>
      ) : null}
      <div className="mt-10 flex min-h-0 flex-1 flex-col">
        {a.kind === 'poll' && <PollBars activity={a} at={t ?? 0} />}
        {a.kind === 'cloud' && <WordCloud activity={a} />}
        {a.kind === 'boss' && <BossTally activity={a} participants={participants} />}
      </div>
    </section>
  )
}

// ─── Poll ───

function PollBars({ activity, at }: { activity: PublicActivity; at: number }) {
  const counts = activity.counts ?? activity.options.map(() => 0)
  const total = counts.reduce((n, c) => n + c, 0)
  const shown = pollRevealed(activity, at)
  const top = shown && total ? Math.max(...counts) : -1
  const long = activity.options.some(o => o.length > 32)
  return (
    <div className="max-w-[88rem]">
      <ul className={cn(long ? 'space-y-6' : 'space-y-8')}>
        {activity.options.map((o, i) => {
          const share = shown && total ? counts[i] / total : 0
          const lead = counts[i] === top && top > 0
          return (
            <li key={i}>
              <div className="flex items-baseline gap-6">
                <span className={cn('min-w-0 flex-1 leading-snug tracking-[-0.01em] text-balance', long ? 'text-[clamp(20px,1.5vw,28px)]' : 'text-[clamp(22px,1.7vw,32px)]', lead ? 'font-semibold text-ink' : 'text-ink-soft')}>{o}</span>
                <span className={cn('shrink-0 font-mono text-[clamp(24px,1.9vw,36px)] tabular tracking-[-0.02em] transition-opacity duration-500', shown ? 'opacity-100' : 'opacity-0', lead ? 'text-ink' : 'text-ink-muted')}>
                  <Tween value={Math.round(share * 100)} />%
                </span>
              </div>
              <div className="mt-2.5 h-3.5 overflow-hidden rounded-full bg-kinu/80">
                <div
                  className={cn('h-full rounded-full transition-[width,background-color] duration-[900ms] motion-reduce:transition-none', EASE, lead ? 'bg-ink' : 'bg-ink/35')}
                  style={{ width: `${share * 100}%` }}
                />
              </div>
            </li>
          )
        })}
      </ul>
      {activity.status === 'open' && !shown && (
        <p className="mt-8 font-mono text-[17px] tabular text-ink-muted" aria-live="polite">
          {total} {total === 1 ? 'vote' : 'votes'} in · the bars show in a moment
        </p>
      )}
    </div>
  )
}

// ─── Word cloud ───

const CLOUD_MIN = 26
const CLOUD_MAX = 96
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

/**
 * The words as rows, laid out by hand rather than left to flex-wrap: the
 * biggest word goes in the middle row, the next ones alternate above and
 * below, and every word after that joins the shortest row; within a row the
 * biggest sit in the centre. So the cloud is heaviest in the middle and no
 * row is all small words. Fonts shrink together if the rows would overflow.
 */
export function cloudRows<T extends { word: string; n: number }>(words: T[], width: number, height: number): { rows: { w: T; size: number }[][]; scale: number } {
  const top = words[0]?.n ?? 1
  const sized = words.map(w => ({ w, size: CLOUD_MIN + (CLOUD_MAX - CLOUD_MIN) * cloudWeight(w.n, top) }))
  const gap = 36
  const est = (x: { w: T; size: number }) => x.w.word.length * x.size * 0.56 + gap
  const total = sized.reduce((s, x) => s + est(x), 0)
  let count = Math.max(1, Math.min(7, Math.ceil(total / (width * 0.82))))
  if (count > 1 && count % 2 === 0) count += 1
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
  const centred = rows.map(row => {
    const out: typeof row = []
    row.forEach((x, i) => (i % 2 === 0 ? out.push(x) : out.unshift(x)))
    return out
  })
  // Overflow: shrink everything by the worst of width and height.
  const rowH = centred.map(row => Math.max(CLOUD_MIN, ...row.map(x => x.size)) * 1.2 + 8)
  const tallest = rowH.reduce((a, b) => a + b, 0)
  const widest = Math.max(...widths)
  const scale = Math.min(1, height > 0 ? height / tallest : 1, width > 0 ? (width * 0.98) / widest : 1)
  return { rows: centred, scale: Math.max(0.5, scale) }
}

function WordCloud({ activity }: { activity: PublicActivity }) {
  const words = activity.words ?? []
  const box = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 1600, h: 480 })
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setSize({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  if (!words.length) {
    return (
      <div ref={box} className="flex min-h-0 flex-1 items-center justify-center">
        <p className="text-[22px] text-ink-muted">Waiting for the first word…</p>
      </div>
    )
  }
  const { rows, scale } = cloudRows(words, size.w, size.h)
  // One list, rows split by full-width breaks: a word that changes row moves
  // rather than re-mounting, so only a new word plays its landing.
  return (
    <div ref={box} className="flex min-h-0 flex-1 flex-col justify-center overflow-hidden">
      <ul aria-label="Words so far" className="flex flex-wrap items-baseline justify-center gap-x-9 gap-y-2">
        {rows.flatMap((row, r) => [
          ...(r > 0 ? [<li key={`row-${r}`} aria-hidden className="h-0 basis-full" />] : []),
          ...row.map(({ w, size: px }) => {
            const weight = (px - CLOUD_MIN) / (CLOUD_MAX - CLOUD_MIN)
            return (
              <li
                key={w.word}
                className={cn(
                  'gb-word-land whitespace-nowrap leading-[1.2] tracking-[-0.025em] transition-[font-size,color] duration-700 motion-reduce:transition-none',
                  EASE,
                  weight > 0.55 ? 'font-semibold text-ink' : weight > 0.2 ? 'font-medium text-ink' : 'text-ink-soft',
                )}
                style={{ fontSize: `${Math.round(px * scale)}px` }}
              >
                {w.word}
                {w.n > 1 && <span className="sr-only"> ({w.n})</span>}
              </li>
            )
          }),
        ])}
      </ul>
    </div>
  )
}

// ─── Boss Round ───

/** The pass rate, large; "–" until someone has passed. No clock: Kers' verdict shows once it's closed. */
function BossTally({ activity, participants }: { activity: PublicActivity; participants: number }) {
  const { passed = 0, trying = 0, pct = 0 } = activity.tally ?? {}
  const closed = activity.status === 'closed'
  const blank = !closed && passed === 0
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-end gap-16">
        <div className="relative">
          {blank ? (
            // "–" until someone passes: a quiet dash at the number's height, not a big 0%.
            <p role="img" aria-label="Nobody has passed yet" className="flex h-[clamp(108px,9.9vw,187px)] items-center">
              <span className="block h-2 w-28 rounded-full bg-ink-muted/30" />
            </p>
          ) : (
            <p className="font-mono text-[clamp(120px,11vw,208px)] leading-[0.9] tabular tracking-[-0.06em] text-ink"><Tween value={pct} />%</p>
          )}
          {closed && trying > 0 && pct >= 50 && <Confetti />}
        </div>
        <div className="pb-3">
          <p className="text-[clamp(22px,1.6vw,30px)] leading-snug text-ink">
            passed every test
          </p>
          <p className="mt-2 font-mono text-[17px] tabular text-ink-muted">
            <Tween value={passed} /> passed · <Tween value={trying} /> {trying === 1 ? 'person' : 'people'} trying{participants ? ` of ${participants}` : ''}
          </p>
        </div>
      </div>
      <div className="mt-8 h-3 max-w-[88rem] overflow-hidden rounded-full bg-kinu/80">
        <div className={cn('h-full rounded-full bg-ink transition-[width] duration-[900ms] motion-reduce:transition-none', EASE)} style={{ width: `${blank ? 0 : pct}%` }} />
      </div>
      {closed && (
        <figure className="gb-verdict mt-10 max-w-[60rem]">
          <blockquote className="text-[clamp(28px,2.2vw,40px)] font-medium leading-snug tracking-[-0.02em] text-ink text-balance">“{bossVerdict(pct, trying)}”</blockquote>
          <figcaption className="mt-2 font-mono text-[14px] uppercase tracking-[0.18em] text-ink-muted">Kers’ verdict</figcaption>
        </figure>
      )}
    </div>
  )
}

/** A small, one-off burst over the verdict's number. Decorative; none under reduced motion (globals.css). */
function Confetti() {
  const bits = Array.from({ length: 18 }, (_, i) => {
    const angle = (i / 18) * Math.PI * 2 + (i % 3) * 0.2
    const dist = 120 + (i % 4) * 36
    return {
      x: Math.round(Math.cos(angle) * dist),
      y: Math.round(Math.sin(angle) * dist * 0.7 - 40),
      r: (i * 47) % 360,
      tone: i % 3,
      delay: (i % 5) * 30,
    }
  })
  return (
    <span aria-hidden className="pointer-events-none absolute left-1/2 top-1/2">
      {bits.map((b, i) => (
        <span
          key={i}
          className={cn('gb-confetti absolute block h-3 w-1.5 rounded-[2px]', b.tone === 0 ? 'bg-ink' : b.tone === 1 ? 'bg-[#3FCB98]' : 'bg-ink/40')}
          style={{ '--x': `${b.x}px`, '--y': `${b.y}px`, '--r': `${b.r}deg`, animationDelay: `${b.delay}ms` } as React.CSSProperties}
        />
      ))}
    </span>
  )
}

// ─── Motion helpers ───

/** A number that eases to its new value (≈600 ms), or jumps under reduced motion. */
function Tween({ value }: { value: number }) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    const start = from.current
    if (start === value) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      from.current = value
      const id = setTimeout(() => setShown(value), 0)
      return () => clearTimeout(id)
    }
    const t0 = performance.now()
    let raf = 0
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / 600)
      const eased = 1 - Math.pow(1 - p, 4)
      const v = Math.round(start + (value - start) * eased)
      from.current = v
      setShown(v)
      if (p < 1) raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value])
  return <span className="tabular">{shown}</span>
}

/** The server's time, ticking twice a second while `on` (the poll's 8 s reveal). */
function useTicking(on: boolean, now: () => number): number | null {
  const [t, setT] = useState<number | null>(null)
  useEffect(() => {
    const first = setTimeout(() => setT(now()), 0)
    if (!on) return () => clearTimeout(first)
    const id = setInterval(() => setT(now()), 500)
    return () => {
      clearTimeout(first)
      clearInterval(id)
    }
  }, [on, now])
  return t
}
