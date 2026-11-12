'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ChartBar, CloudSun, Code, Play } from '@phosphor-icons/react/dist/ssr'
import type { Icon as PhosphorIcon } from '@phosphor-icons/react'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/utils/cn'
import { pollRevealed, type ActivityKind, type PublicActivity } from '@/lib/meet/activity'
import { bossProblem, bossVerdict } from '@/lib/meet/boss'
import { KIND_LABELS, type MeetingState, type Segment } from '@/lib/meeting'

const KIND_NAME: Record<ActivityKind, string> = { poll: 'Poll', cloud: 'Word cloud', boss: 'Boss Round' }
const KIND_ICON: Record<ActivityKind, PhosphorIcon> = { poll: ChartBar, cloud: CloudSun, boss: Code }
const EASE = 'ease-[cubic-bezier(0.23,1,0.32,1)]'

/**
 * Soft colour, one hue per poll option and per cloud word: the guild's own
 * tokens at low alpha, so the screen has colour without a second accent.
 * Saffron stays the presenter's button. Full class strings (Tailwind scans them).
 */
const PASTELS = [
  { bar: 'bg-indigo-jp/[0.13]', lead: 'bg-indigo-jp/[0.22]', edge: 'border-indigo-jp/25', dot: 'bg-indigo-jp', pill: 'bg-indigo-jp/[0.09] border-indigo-jp/20', top: 'bg-indigo-jp/[0.2] border-indigo-jp/45' },
  { bar: 'bg-matcha/[0.13]', lead: 'bg-matcha/[0.22]', edge: 'border-matcha/25', dot: 'bg-matcha', pill: 'bg-matcha/[0.09] border-matcha/20', top: 'bg-matcha/[0.2] border-matcha/45' },
  { bar: 'bg-wisteria/[0.13]', lead: 'bg-wisteria/[0.22]', edge: 'border-wisteria/25', dot: 'bg-wisteria', pill: 'bg-wisteria/[0.09] border-wisteria/20', top: 'bg-wisteria/[0.2] border-wisteria/45' },
  { bar: 'bg-vermillion/[0.1]', lead: 'bg-vermillion/[0.18]', edge: 'border-vermillion/25', dot: 'bg-vermillion', pill: 'bg-vermillion/[0.07] border-vermillion/20', top: 'bg-vermillion/[0.16] border-vermillion/40' },
] as const

/** A word's pastel: stable per word, so it keeps its colour as the cloud reflows. */
function wordTone(word: string) {
  let h = 0
  for (let i = 0; i < word.length; i++) h = (h * 31 + word.charCodeAt(i)) >>> 0
  return PASTELS[h % PASTELS.length]
}

type Call = (action: string, payload?: Record<string, unknown>, done?: string) => Promise<unknown>

/** The segment's activity, if it has one (any status). */
export function segmentActivity(state: MeetingState, segment: Segment): PublicActivity | null {
  const a = state.room?.activity
  return a && a.segmentId === segment.id ? a : null
}

/**
 * An activity that hasn't opened yet, as a board-style card under the
 * segment: what the room will be asked, and for the presenter the one
 * "Open" button (the screen's single saffron action).
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
  return (
    <section aria-label={name} className="elev-1 flex max-w-[56rem] items-center gap-4 rounded-(--radius-card) px-5 py-4">
      <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-(--radius-control) bg-fill text-ink-soft">
        <Icon icon={KIND_ICON[activity.kind]} size="md" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="eyebrow">{name} · on everyone’s phone once it opens</p>
        <p className="mt-1 text-[clamp(17px,1.05vw,20px)] font-semibold leading-snug tracking-[-0.015em] text-ink text-balance">{activity.prompt}</p>
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
 * A closed activity, small: the final result under the segment's cards
 * (stageFor in lib/meet/activity.ts), and on top of the cards on a phone.
 * Poll: the split as thin bars in each option's colour, the winner bold.
 * Cloud: the top words as pastel pills. Boss: the pass rate and Kers'
 * verdict. The presenter gets "Show results big" and "Reopen", both quiet.
 */
export function ActivityResults({
  activity: a,
  size,
  presenting = false,
  call,
  busy = null,
  onBig,
}: {
  activity: PublicActivity
  size: 'screen' | 'phone'
  presenting?: boolean
  call?: Call
  busy?: string | null
  onBig?: () => void
}) {
  const screen = size === 'screen'
  const name = KIND_NAME[a.kind]
  const counts = a.counts ?? a.options.map(() => 0)
  const votes = counts.reduce((n, c) => n + c, 0)
  const top = votes ? Math.max(...counts) : -1
  const { passed = 0, trying = 0, pct = 0 } = a.tally ?? {}
  const summary =
    a.kind === 'poll' ? `${votes} ${votes === 1 ? 'vote' : 'votes'}`
    : a.kind === 'cloud' ? `${a.answered} ${a.answered === 1 ? 'person' : 'people'} · ${a.total} ${a.total === 1 ? 'word' : 'words'}`
    : `${passed} of ${trying} passed`
  return (
    <section aria-label={`${name} results`} className={cn('rounded-(--radius-card) border border-border bg-paper', screen ? 'max-w-[72rem] px-6 py-4' : 'px-4 py-3.5')}>
      <div className="flex items-center gap-3">
        <span aria-hidden className={cn('grid shrink-0 place-items-center rounded-(--radius-control) bg-fill text-ink-soft', screen ? 'size-9' : 'size-7')}>
          <Icon icon={KIND_ICON[a.kind]} size={screen ? 'md' : 'sm'} />
        </span>
        <div className="min-w-0 flex-1">
          <p className={cn('font-mono uppercase tracking-[0.14em] text-ink-muted', screen ? 'text-[12px]' : 'text-[11px]')}>
            {name} · results · <span className="tabular">{summary}</span>
          </p>
          <p className={cn('truncate font-semibold tracking-[-0.012em] text-ink', screen ? 'text-[18px]' : 'text-[15px]')}>{a.prompt}</p>
        </div>
        {presenting && call && (
          <div className="flex shrink-0 items-center gap-1 opacity-70 transition-opacity duration-200 hover:opacity-100 focus-within:opacity-100">
            {onBig && <Button variant="secondary" onClick={onBig}>Show results big</Button>}
            <Button variant="ghost" disabled={!!busy} onClick={() => call('open_activity', { activity_id: a.id })}>Reopen</Button>
          </div>
        )}
      </div>

      {a.kind === 'poll' && (
        <ul className={cn('grid gap-x-8', screen ? 'mt-3 gap-y-1.5' : 'mt-3 gap-y-2')} style={screen && a.options.length === 4 ? { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' } : screen ? { maxWidth: '44rem' } : undefined}>
          {a.options.map((o, i) => {
            const share = votes ? counts[i] / votes : 0
            const lead = counts[i] === top && top > 0
            const tone = PASTELS[i % PASTELS.length]
            return (
              <li key={i} className={cn('flex items-center gap-3', screen ? 'text-[15px]' : 'text-[13px]')}>
                <span className={cn('min-w-0 truncate', screen ? 'w-[46%]' : 'w-[48%]', lead ? 'font-semibold text-ink' : 'text-ink-soft')}>{o}</span>
                <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-fill">
                  <span className={cn('block h-full rounded-full', tone.dot, lead ? 'opacity-80' : 'opacity-45')} style={{ width: `${share * 100}%` }} />
                </span>
                <span className={cn('num w-11 shrink-0 text-right', lead ? 'font-semibold text-ink' : 'text-ink-muted')}>{Math.round(share * 100)}%</span>
              </li>
            )
          })}
        </ul>
      )}
      {a.kind === 'cloud' && (
        <ul aria-label="Top words" className="mt-3 flex flex-wrap items-center gap-2">
          {(a.words ?? []).slice(0, screen ? 8 : 6).map((w, i) => (
            <li
              key={w.word}
              className={cn('whitespace-nowrap rounded-full border px-3 leading-[1.7] text-ink', wordTone(w.word).pill, i === 0 ? 'font-semibold' : '', screen ? (i === 0 ? 'text-[20px]' : 'text-[15px]') : i === 0 ? 'text-[16px]' : 'text-[13px]')}
            >
              {w.word}
              {w.n > 1 && <span className="ml-1.5 text-[0.8em] text-ink-muted tabular">{w.n}</span>}
            </li>
          ))}
          {!(a.words ?? []).length && <li className="text-footnote text-ink-muted">No words this time.</li>}
        </ul>
      )}
      {a.kind === 'boss' && (
        <div className="mt-3 flex items-center gap-4">
          <p className={cn('num shrink-0 font-semibold tracking-[-0.03em] text-matcha', screen ? 'text-[34px]' : 'text-[26px]')}>{trying ? `${pct}%` : '–'}</p>
          <p className={cn('rounded-2xl rounded-bl-md border border-border bg-sumi px-3.5 py-2 leading-snug text-ink text-pretty', screen ? 'text-[16px]' : 'text-[13px]')}>
            <span className="sr-only">Kers’ verdict: </span>{bossVerdict(pct, trying)}
          </p>
        </div>
      )}
    </section>
  )
}

/**
 * An open or closed activity, as the hero of the presenter screen
 * (docs/06-meeting-mode.md): the question, then the answers as they come in:
 * poll options as the board's poll rows with their bars filling (hidden for
 * the first 8 s, so the first votes don't steer the rest), the word cloud as
 * pills that pop in, or the Boss Round's pass rate and a dot per person in
 * the room. Closed, it shows the final result; the presenter may open it
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
  onBack,
}: {
  segment: Segment
  activity: PublicActivity
  participants: number
  presenting: boolean
  now: () => number
  call: Call
  busy: string | null
  /** Closed and shown big: back to the segment's cards. */
  onBack?: () => void
}) {
  const t = useTicking(a.status === 'open' && a.kind === 'poll', now)
  const open = a.status === 'open'
  const counted = a.kind === 'boss' ? `${a.answered} of ${participants} trying` : `${a.answered} of ${participants} answered`
  const problem = a.kind === 'boss' ? bossProblem(a.config) : null
  const where = KIND_LABELS[segment.kind] === KIND_NAME[a.kind] ? KIND_NAME[a.kind] : `${KIND_LABELS[segment.kind]} · ${KIND_NAME[a.kind]}`

  return (
    <section aria-label={KIND_NAME[a.kind]} className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-9 items-center gap-4">
        <p className="eyebrow">{where}</p>
        <span className="inline-flex h-7 items-center gap-2 rounded-full bg-fill px-3 font-mono text-[13px] tabular text-ink-soft">
          {open && (
            <span aria-hidden className="relative flex size-2">
              <span className="absolute inset-0 rounded-full bg-matcha opacity-60 motion-safe:animate-ping" />
              <span className="relative size-2 rounded-full bg-matcha" />
            </span>
          )}
          {open ? counted : `Closed · ${a.answered} ${a.kind === 'boss' ? 'tried' : 'answered'}`}
        </span>
        {presenting && (
          <div className="ml-auto opacity-60 transition-opacity duration-200 hover:opacity-100 focus-within:opacity-100">
            {open ? (
              <Button variant="ghost" disabled={!!busy} onClick={() => call('close_activity', { activity_id: a.id })}>
                {a.kind === 'boss' ? 'Close the round' : 'Close'}
              </Button>
            ) : (
              <span className="flex items-center gap-1">
                {onBack && <Button variant="ghost" onClick={onBack}>Back to the cards</Button>}
                <Button variant="ghost" disabled={!!busy} onClick={() => call('open_activity', { activity_id: a.id })}>Reopen</Button>
              </span>
            )}
          </div>
        )}
      </div>
      <h1 className="mt-3 max-w-[34ch] text-[clamp(32px,2.3vw,44px)] font-semibold leading-[1.12] tracking-[-0.025em] text-ink text-balance">{a.prompt}</h1>
      {problem ? (
        <p className="mt-3 max-w-[70ch] text-[clamp(17px,1vw,19px)] leading-relaxed text-ink-soft">
          {problem.description} <span className="whitespace-nowrap rounded-(--radius-control) bg-fill px-2 py-0.5 font-mono text-[0.9em] text-ink">{problem.signature}</span>
          <span className="text-ink-muted"> · {problem.cases.length} tests</span>
        </p>
      ) : open ? (
        <p className="mt-2 text-[16px] text-ink-muted">On your phone or laptop: open GuildBoard and join the room.</p>
      ) : null}
      <div className="mt-8 flex min-h-0 flex-1 flex-col">
        {a.kind === 'poll' && <PollBars activity={a} at={t ?? 0} />}
        {a.kind === 'cloud' && <WordCloud activity={a} />}
        {a.kind === 'boss' && <BossTally activity={a} participants={participants} />}
      </div>
    </section>
  )
}

// ─── Poll: the board's poll rows, big ───

function PollBars({ activity, at }: { activity: PublicActivity; at: number }) {
  const counts = activity.counts ?? activity.options.map(() => 0)
  const total = counts.reduce((n, c) => n + c, 0)
  const shown = pollRevealed(activity, at)
  const top = shown && total ? Math.max(...counts) : -1
  return (
    <div className="max-w-[72rem]">
      <ul className="space-y-3.5">
        {activity.options.map((o, i) => {
          const share = shown && total ? counts[i] / total : 0
          const lead = counts[i] === top && top > 0
          const tone = PASTELS[i % PASTELS.length]
          return (
            <li
              key={i}
              className={cn('relative overflow-hidden rounded-(--radius-card) border bg-paper transition-colors duration-500', lead ? tone.edge : 'border-border')}
            >
              {/* The bar sits behind the text, as on the board's poll card, in the option's own soft colour. */}
              <span
                aria-hidden
                className={cn('absolute inset-y-0 left-0 transition-[width,background-color] duration-[900ms] motion-reduce:transition-none', EASE, lead ? tone.lead : tone.bar)}
                style={{ width: `${share * 100}%` }}
              />
              <span className="relative flex min-h-[68px] items-center gap-5 px-6 py-2.5">
                <span aria-hidden className={cn('size-2.5 shrink-0 rounded-full', tone.dot)} />
                <span className={cn('min-w-0 flex-1 text-[clamp(18px,1.15vw,22px)] leading-snug tracking-[-0.012em] text-balance', lead ? 'font-semibold text-ink' : 'text-ink-soft')}>{o}</span>
                <span className={cn('num shrink-0 text-[clamp(20px,1.3vw,26px)] transition-opacity duration-500', shown ? 'opacity-100' : 'opacity-0', lead ? 'font-semibold text-ink' : 'text-ink-muted')}>
                  <Tween value={Math.round(share * 100)} />%
                </span>
              </span>
            </li>
          )
        })}
      </ul>
      {activity.status === 'open' && !shown && (
        <p className="mt-5 font-mono text-[16px] tabular text-ink-muted" aria-live="polite">
          {total} {total === 1 ? 'vote' : 'votes'} in · the bars show in a moment
        </p>
      )}
    </div>
  )
}

// ─── Word cloud: pills ───

const CLOUD_MIN = 18
const CLOUD_MAX = 64
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
  const gap = 14
  // A pill: the word, plus 0.6em padding each side and its border.
  const est = (x: { w: T; size: number }) => x.w.word.length * x.size * 0.56 + x.size * 1.2 + gap
  const total = sized.reduce((s, x) => s + est(x), 0)
  let count = Math.max(1, Math.min(7, Math.ceil(total / (width * 0.8))))
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
  const rowH = centred.map(row => Math.max(CLOUD_MIN, ...row.map(x => x.size)) * 1.5 + 14)
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
        <p className="text-[20px] text-ink-muted">Waiting for the first word…</p>
      </div>
    )
  }
  const { rows, scale } = cloudRows(words, size.w, size.h)
  const leader = words[0]
  // One list, rows split by full-width breaks: a word that changes row moves
  // rather than re-mounting, so only a new word plays its landing.
  return (
    <div ref={box} className="flex min-h-0 flex-1 flex-col justify-center overflow-hidden">
      <ul aria-label="Words so far" className="flex flex-wrap items-center justify-center gap-3">
        {rows.flatMap((row, r) => [
          ...(r > 0 ? [<li key={`row-${r}`} aria-hidden className="h-0 basis-full" />] : []),
          ...row.map(({ w, size: px }) => {
            const weight = (px - CLOUD_MIN) / (CLOUD_MAX - CLOUD_MIN)
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

/**
 * The pass rate ("–" until someone passes), and the room as a dot per
 * person: passed, still trying, or watching. Anonymous: the dots are just
 * counts drawn as dots. No clock: Kers' verdict shows once it's closed.
 */
function BossTally({ activity, participants }: { activity: PublicActivity; participants: number }) {
  const { passed = 0, trying = 0, pct = 0 } = activity.tally ?? {}
  const closed = activity.status === 'closed'
  const blank = !closed && passed === 0
  const room = Math.max(participants, trying, 1)
  const shown = Math.min(room, 60)
  const passedDots = Math.round((passed / room) * shown)
  const tryingDots = Math.round((trying / room) * shown)
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid max-w-[72rem] grid-cols-2 gap-5">
        <div className="flex flex-col rounded-(--radius-card) border border-matcha/20 bg-matcha/[0.06] px-6 pb-6 pt-5 dark:bg-matcha/[0.1]">
          <p className="eyebrow">Passed every test</p>
          {blank ? (
            // "–" until someone passes: a quiet dash at the number's height, not a big 0%.
            <p role="img" aria-label="Nobody has passed yet" className="mt-3 flex h-[clamp(72px,5.4vw,104px)] items-center">
              <span className="block h-2 w-24 rounded-full bg-ink-muted/30" />
            </p>
          ) : (
            <p className="num relative mt-3 text-[clamp(72px,6vw,116px)] leading-[0.92] tracking-[-0.05em] text-ink">
              <Tween value={pct} />%
              {closed && trying > 0 && pct >= 50 && <Confetti />}
            </p>
          )}
          <div className="mt-auto pt-6">
            <div className="h-2.5 overflow-hidden rounded-full bg-fill">
              <div className={cn('h-full rounded-full bg-matcha transition-[width] duration-[900ms] motion-reduce:transition-none', EASE)} style={{ width: `${blank ? 0 : pct}%` }} />
            </div>
          </div>
        </div>
        <div className="flex flex-col rounded-(--radius-card) border border-indigo-jp/15 bg-indigo-jp/[0.05] px-6 pb-6 pt-5 dark:bg-indigo-jp/[0.09]">
          <p className="eyebrow">The room</p>
          <ul aria-hidden className="mt-4 flex flex-wrap content-start gap-2">
            {Array.from({ length: shown }, (_, i) => (
              <li
                key={i}
                className={cn(
                  'size-5 rounded-full transition-colors duration-700',
                  i < passedDots ? 'bg-matcha' : i < tryingDots ? 'border-2 border-ink/45' : 'bg-fill-strong',
                )}
              />
            ))}
          </ul>
          <p className="mt-auto flex flex-wrap gap-x-5 gap-y-1 pt-4 font-mono text-[15px] tabular text-ink-muted">
            <span className="inline-flex items-center gap-2"><span aria-hidden className="size-3 rounded-full bg-matcha" /><Tween value={passed} /> passed</span>
            <span className="inline-flex items-center gap-2"><span aria-hidden className="size-3 rounded-full border-2 border-ink/45" /><Tween value={Math.max(0, trying - passed)} /> still trying</span>
            <span className="inline-flex items-center gap-2"><span aria-hidden className="size-3 rounded-full bg-fill-strong" /><Tween value={Math.max(0, participants - trying)} /> watching</span>
          </p>
        </div>
      </div>
      {closed && (
        <figure className="gb-verdict mt-6 max-w-[46rem]">
          <figcaption className="eyebrow">Kers’ verdict</figcaption>
          <blockquote className="mt-2 inline-block rounded-2xl rounded-bl-md border border-border bg-sumi px-5 py-3.5 text-[clamp(20px,1.4vw,26px)] font-medium leading-snug text-ink text-balance">
            {bossVerdict(pct, trying)}
          </blockquote>
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
    <span aria-hidden className="pointer-events-none absolute left-1/3 top-1/2">
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
