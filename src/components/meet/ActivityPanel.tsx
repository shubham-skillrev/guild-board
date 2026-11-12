'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { ArrowRight, ChartBar, CloudSun, Code, Play } from '@phosphor-icons/react/dist/ssr'
import type { Icon as PhosphorIcon } from '@phosphor-icons/react'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/utils/cn'
import { pollRevealed, type ActivityKind, type PublicActivity } from '@/lib/meet/activity'
import { bossProblem, bossVerdict } from '@/lib/meet/boss'
import { activityKeyFor, type MeetingState, type Segment } from '@/lib/meeting'
import { OptionShape, tileFor } from '@/components/meet/tiles'

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

/** The slide's activity, if it has one (any status): an activity slide's own, a results slide's `of`. */
export function segmentActivity(state: MeetingState, segment: Segment): PublicActivity | null {
  const a = state.room?.activity
  return a && a.segmentId === activityKeyFor(state.meeting.agenda, segment.id) ? a : null
}

/**
 * A closed activity, small: on a phone, on an activity or results slide
 * once it's closed. Poll: the split as thin bars in each option's colour and
 * shape, the winner bold.
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
            const tile = tileFor(i)
            return (
              <li key={i} className={cn('flex items-center gap-2.5', screen ? 'text-[15px]' : 'text-[13px]')}>
                <OptionShape i={i} size={screen ? 16 : 13} />
                <span className={cn('min-w-0 truncate', screen ? 'w-[44%]' : 'w-[44%]', lead ? 'font-semibold text-ink' : 'text-ink-soft')}>{o}</span>
                <span className="h-2 min-w-0 flex-1 overflow-hidden rounded-full bg-fill">
                  <span className={cn('block h-full rounded-full', tile.bar, !lead && 'opacity-60')} style={{ width: `${share * 100}%` }} />
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
 * An activity slide on the presenter screen (docs/06-meeting-mode.md,
 * "Slides"): the question big, a live state the whole room can read
 * ("Voting open · 12 of 20 answered", ticking), and the answers as they come
 * in: poll options as coloured tiles with a shape each (the same tiles as on
 * every phone; counts hidden for the first 8 s, so the first votes don't
 * steer the rest), the word cloud, or the Boss Round's pass rate.
 *
 * Arriving on the slide opened it (the server, on goto); leaving closes it.
 * The presenter's one saffron action is always in view: "Close voting" (it
 * moves on to the results slide when that's next), "Open" if it hasn't
 * opened, "Show results" once closed, with a quiet "Reopen" beside it.
 * Everything here is counts, words and rates: nothing names anyone.
 */
export function ActivityHero({
  activity: a,
  cue,
  participants,
  presenting,
  now,
  call,
  busy,
  onClose,
  onResults,
}: {
  activity: PublicActivity
  /** The slide's one line under the question. */
  cue?: string | null
  participants: number
  presenting: boolean
  now: () => number
  call: Call
  busy: string | null
  /** Close it: on to the results slide if that's next, else in place. */
  onClose: () => void
  /** Closed: on to its results (null when no results slide follows). */
  onResults?: (() => void) | null
}) {
  const t = useTicking(a.status === 'open' && a.kind === 'poll', now)
  const open = a.status === 'open'
  const ready = a.status === 'ready'
  const problem = a.kind === 'boss' ? bossProblem(a.config) : null
  const verb = a.kind === 'poll' ? 'Voting' : a.kind === 'cloud' ? 'Words' : 'The round'
  const unit = a.kind === 'boss' ? 'trying' : 'answered'

  return (
    <section aria-label={KIND_NAME[a.kind]} className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-11 items-center gap-4">
        <p
          aria-live="polite"
          className={cn(
            'inline-flex h-11 items-center gap-3 rounded-full px-5 font-mono text-[16px] tabular',
            open ? 'bg-matcha/[0.1] text-ink dark:bg-matcha/[0.16]' : 'bg-fill text-ink-soft',
          )}
        >
          {open && (
            <span aria-hidden className="relative flex size-2.5">
              <span className="absolute inset-0 rounded-full bg-matcha opacity-60 motion-safe:animate-ping" />
              <span className="relative size-2.5 rounded-full bg-matcha" />
            </span>
          )}
          <span>{ready ? `${KIND_NAME[a.kind]} · not open yet` : `${verb} ${open ? 'open' : 'closed'}`}</span>
          {!ready && (
            <>
              <span aria-hidden className="text-ink-muted">·</span>
              <span>
                <span className="font-semibold text-ink"><Tween value={a.answered} /></span>
                {open ? <> of {participants} {unit}</> : <> {a.kind === 'boss' ? 'tried' : 'answered'}</>}
              </span>
            </>
          )}
        </p>
        {presenting && (
          <div className="ml-auto flex items-center gap-2">
            {open ? (
              <Button size="md" icon={a.kind === 'boss' ? undefined : ArrowRight} disabled={!!busy} onClick={onClose} className="h-12! px-6! text-[17px]!">
                {a.kind === 'boss' ? 'Close the round' : a.kind === 'poll' ? 'Close voting' : 'Close the cloud'}
                {onResults !== undefined && <span className="sr-only">, then show the results</span>}
              </Button>
            ) : ready ? (
              <Button icon={Play} disabled={!!busy} onClick={() => call('open_activity', { activity_id: a.id })} className="h-12! px-6! text-[17px]!">
                {busy === 'open_activity' ? 'Opening…' : `Open the ${KIND_NAME[a.kind].toLowerCase()}`}
              </Button>
            ) : (
              <>
                <Button variant="ghost" disabled={!!busy} onClick={() => call('open_activity', { activity_id: a.id })}>Reopen</Button>
                {onResults && <Button icon={ArrowRight} onClick={onResults} className="h-12! px-6! text-[17px]!">Show results</Button>}
              </>
            )}
          </div>
        )}
      </div>
      <h1 className="mt-7 max-w-[30ch] text-[clamp(36px,2.7vw,52px)] font-semibold leading-[1.1] tracking-[-0.03em] text-ink text-balance">{a.prompt}</h1>
      {problem ? (
        <p className="mt-3 max-w-[70ch] text-[clamp(17px,1vw,19px)] leading-relaxed text-ink-soft">
          {problem.description} <span className="whitespace-nowrap rounded-(--radius-control) bg-fill px-2 py-0.5 font-mono text-[0.9em] text-ink">{problem.signature}</span>
          <span className="text-ink-muted"> · {problem.cases.length} tests</span>
        </p>
      ) : cue ? (
        <p className="mt-3 text-[clamp(18px,1.15vw,22px)] text-ink-muted">{cue}</p>
      ) : null}
      <div className="mt-10 flex min-h-0 flex-1 flex-col">
        {a.kind === 'poll' && <PollTiles activity={a} at={t ?? 0} />}
        {a.kind === 'cloud' && <WordCloud activity={a} />}
        {a.kind === 'boss' && <BossTally activity={a} participants={participants} verdict={false} />}
      </div>
    </section>
  )
}

/**
 * A results slide (docs/06-meeting-mode.md, "Slides"): one activity's
 * results, big, with the slide's cue as the question to talk about. A poll
 * is columns that rise one by one after a short drumroll, the winner popping
 * last; a cloud is the full cloud; the Boss Round is the pass rate and Kers'
 * verdict.
 */
export function ResultsHero({ activity: a, title, cue, participants }: { activity: PublicActivity; title: string; cue: string | null; participants: number }) {
  return (
    <section aria-label={`${KIND_NAME[a.kind]} results`} className="flex min-h-0 flex-1 flex-col">
      <p className="eyebrow flex items-center gap-2.5">
        <Icon icon={KIND_ICON[a.kind]} size="sm" />
        <span>{a.kind === 'boss' ? 'Results' : a.prompt}</span>
        <span aria-hidden className="text-ink-muted">·</span>
        <span className="tabular">{a.answered} {a.kind === 'boss' ? 'tried' : 'answered'}</span>
      </p>
      <h1 className="mt-3 max-w-[36ch] text-[clamp(34px,2.5vw,48px)] font-semibold leading-[1.1] tracking-[-0.03em] text-ink text-balance">{cue || title}</h1>
      <div className="mt-8 flex min-h-0 flex-1 flex-col">
        {a.kind === 'poll' && <PollColumns activity={a} />}
        {a.kind === 'cloud' && <WordCloud activity={a} />}
        {a.kind === 'boss' && <BossTally activity={a} participants={participants} verdict />}
      </div>
    </section>
  )
}

// ─── Poll: tiles while it's open, columns for the results ───

function PollTiles({ activity, at }: { activity: PublicActivity; at: number }) {
  const counts = activity.counts ?? activity.options.map(() => 0)
  const total = counts.reduce((n, c) => n + c, 0)
  const shown = pollRevealed(activity, at)
  const top = shown && total ? Math.max(...counts) : -1
  const n = activity.options.length
  return (
    <div className="max-w-[88rem]">
      <ul className="grid gap-4" style={{ gridTemplateColumns: `repeat(${n === 3 ? 3 : 2}, minmax(0, 1fr))` }}>
        {activity.options.map((o, i) => {
          const share = shown && total ? counts[i] / total : 0
          const lead = counts[i] === top && top > 0
          const tile = tileFor(i)
          return (
            <li key={i} className={cn('relative overflow-hidden rounded-(--radius-card) border transition-colors duration-500', tile.tile, lead && activity.status === 'closed' && tile.on)}>
              {/* The share fills the tile from the left, in its own colour. */}
              <span aria-hidden className={cn('absolute inset-y-0 left-0 transition-[width] duration-[900ms] motion-reduce:transition-none', EASE, tile.fill)} style={{ width: `${share * 100}%` }} />
              <span className={cn('relative flex items-center gap-5 px-7', n === 3 ? 'min-h-[132px]' : 'min-h-[104px]')}>
                <OptionShape i={i} size={34} />
                <span className={cn('min-w-0 flex-1 text-[clamp(21px,1.35vw,26px)] font-medium leading-snug tracking-[-0.015em] text-ink text-balance')}>{o}</span>
                <span className={cn('num shrink-0 text-[clamp(24px,1.6vw,32px)] transition-opacity duration-500', shown ? 'opacity-100' : 'opacity-0', lead ? 'font-semibold text-ink' : 'text-ink-soft')}>
                  <Tween value={Math.round(share * 100)} />%
                </span>
              </span>
            </li>
          )
        })}
      </ul>
      {activity.status === 'open' && !shown && (
        <p className="mt-5 font-mono text-[16px] tabular text-ink-muted" aria-live="polite">
          {total} {total === 1 ? 'vote' : 'votes'} in · the counts show in a moment
        </p>
      )}
    </div>
  )
}

/** How long the drumroll lasts before the first column rises, and the gap between columns. */
const DRUM_MS = 1100
const RISE_GAP_MS = 380

function PollColumns({ activity }: { activity: PublicActivity }) {
  const counts = activity.counts ?? activity.options.map(() => 0)
  const total = counts.reduce((n, c) => n + c, 0)
  const max = Math.max(1, ...counts)
  const top = total ? Math.max(...counts) : -1
  const n = activity.options.length
  // The winner rises last, after the drumroll: the others in option order.
  const order = activity.options.map((_, i) => i).sort((x, y) => (counts[x] === top ? 1 : 0) - (counts[y] === top ? 1 : 0))
  const delayOf = (i: number) => DRUM_MS + order.indexOf(i) * RISE_GAP_MS
  const done = DRUM_MS + n * RISE_GAP_MS + 450
  const drumming = useDrumroll(total > 0)
  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
      {drumming && (
        <p aria-hidden className="gb-drum absolute inset-x-0 top-[30%] text-center font-mono text-[44px] leading-none text-ink-muted">
          <span>·</span><span>·</span><span>·</span>
        </p>
      )}
      <ul className="mx-auto grid min-h-0 w-full max-w-[84rem] flex-1 items-end gap-8" style={{ gridTemplateColumns: `repeat(${n}, minmax(0, 1fr))` }}>
        {activity.options.map((o, i) => {
          const share = total ? counts[i] / total : 0
          const lead = counts[i] === top && top > 0
          const tile = tileFor(i)
          return (
            <li key={i} className="flex h-full min-h-0 flex-col items-center justify-end">
              <p className={cn('gb-fade-late num mb-3 text-[clamp(30px,2.2vw,44px)] tracking-[-0.03em]', lead ? 'font-semibold text-ink' : 'text-ink-soft')} style={{ animationDelay: `${delayOf(i) + 450}ms` }}>
                {Math.round(share * 100)}%
                <span className="ml-2 text-[0.5em] font-normal text-ink-muted">{counts[i]}</span>
              </p>
              <div className={cn('flex min-h-[8px] w-full origin-bottom flex-col justify-end', lead && 'gb-pop')} style={{ height: `${Math.max(2, (counts[i] / max) * 100)}%`, ...(lead ? { animationDelay: `${done}ms` } : {}) }}>
                <div className={cn('gb-rise h-full w-full rounded-t-[14px] border border-b-0', lead ? tile.on : tile.tile)} style={{ animationDelay: `${delayOf(i)}ms` }} />
              </div>
              <div className={cn('flex w-full items-center gap-3 border-t-2 pt-4', lead ? 'border-ink/70' : 'border-border-strong')}>
                <OptionShape i={i} size={26} />
                <span className={cn('min-w-0 text-[clamp(18px,1.15vw,22px)] leading-snug text-balance', lead ? 'font-semibold text-ink' : 'text-ink-soft')}>{o}</span>
              </div>
              {lead && <span className="sr-only">Most votes</span>}
            </li>
          )
        })}
      </ul>
      {!total && <p className="mt-6 text-center text-[20px] text-ink-muted">No votes this time.</p>}
    </div>
  )
}

/** True for the drumroll's first moment (none under reduced motion). */
function useDrumroll(on: boolean): boolean {
  const [drum, setDrum] = useState(on)
  useEffect(() => {
    if (!on) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const id = setTimeout(() => setDrum(false), reduce ? 0 : DRUM_MS)
    return () => clearTimeout(id)
  }, [on])
  return drum && on
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
function BossTally({ activity, participants, verdict }: { activity: PublicActivity; participants: number; verdict: boolean }) {
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
      {closed && verdict && (
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
