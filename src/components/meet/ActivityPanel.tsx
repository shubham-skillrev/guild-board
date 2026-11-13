'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowRight, ChartBar, CloudSun, Code, Play } from '@phosphor-icons/react/dist/ssr'
import type { Icon as PhosphorIcon } from '@phosphor-icons/react'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/utils/cn'
import { pollRevealed, type ActivityKind, type PublicActivity } from '@/lib/meet/activity'
import { bossProblem, bossVerdict } from '@/lib/meet/boss'
import { activityKeyFor, type MeetingState, type Segment } from '@/lib/meeting'
import { PollResultTiles, WordCloud } from '@/components/meet/Results'
import { CountdownRing, useCountdown } from '@/components/meet/CountdownRing'
import { EXTEND_S } from '@/lib/meet/timer'

const KIND_NAME: Record<ActivityKind, string> = { poll: 'Poll', cloud: 'Word cloud', boss: 'Boss Round' }
const KIND_ICON: Record<ActivityKind, PhosphorIcon> = { poll: ChartBar, cloud: CloudSun, boss: Code }
const EASE = 'ease-[cubic-bezier(0.23,1,0.32,1)]'

type Call = (action: string, payload?: Record<string, unknown>, done?: string) => Promise<unknown>

/** The slide's activity, if it has one (any status): an activity slide's own, a results slide's `of`. */
export function segmentActivity(state: MeetingState, segment: Segment): PublicActivity | null {
  const a = state.room?.activity
  return a && a.segmentId === activityKeyFor(state.meeting.agenda, segment.id) ? a : null
}

/**
 * An activity's results on a phone (or a laptop in the room), once it has
 * opened: the same renderers as the shared screen (components/meet/Results.tsx).
 * Poll: the voting tiles with their % and fill, the winner ringed once
 * closed, and this person's own vote marked "you picked" (`mine`). Cloud:
 * the same pastel cloud, smaller. Boss: the pass rate and Kers' verdict.
 */
export function ActivityResults({ activity: a, mine = null }: { activity: PublicActivity; mine?: number | null }) {
  const name = KIND_NAME[a.kind]
  const votes = (a.counts ?? []).reduce((n, c) => n + c, 0)
  const { passed = 0, trying = 0, pct = 0 } = a.tally ?? {}
  const summary =
    a.kind === 'poll' ? `${votes} ${votes === 1 ? 'vote' : 'votes'}`
    : a.kind === 'cloud' ? `${a.answered} ${a.answered === 1 ? 'person' : 'people'} · ${a.total} ${a.total === 1 ? 'word' : 'words'}`
    : `${passed} of ${trying} passed`
  return (
    <section aria-label={`${name} results`}>
      <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-muted">
        <Icon icon={KIND_ICON[a.kind]} size="sm" />
        <span>{a.status === 'open' ? 'So far' : 'Results'} · <span className="tabular">{summary}</span></span>
      </p>
      <div className="mt-3">
        {a.kind === 'poll' && <PollResultTiles activity={a} size="phone" mine={mine} />}
        {a.kind === 'cloud' && <WordCloud activity={a} size="phone" />}
        {a.kind === 'boss' && (
          <div className="flex items-center gap-4">
            <p className="num shrink-0 text-[26px] font-semibold tracking-[-0.03em] text-matcha">{trying ? `${pct}%` : '–'}</p>
            <p className="rounded-2xl rounded-bl-md border border-border bg-sumi px-3.5 py-2 text-[13px] leading-snug text-ink text-pretty">
              <span className="sr-only">Kers’ verdict: </span>{bossVerdict(pct, trying)}
            </p>
          </div>
        )}
      </div>
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
 * While open, the countdown ring (lib/meet/timer.ts) runs beside the state:
 * at zero the screen pulls the room (`onExpire`) and the server closes it.
 * The presenter's one saffron action is always in view: "Close voting" (it
 * moves on to the results slide when that's next; "close now"), with a quiet
 * "+30s" beside it, "Open" if it hasn't opened, "Show results" once closed,
 * with a quiet "Reopen" beside it.
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
  onExpire,
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
  /** The countdown hit zero: pull the room, so the server closes it. */
  onExpire?: () => void
}) {
  const t = useTicking(a.status === 'open' && a.kind === 'poll', now)
  const countdown = useCountdown(a, now, onExpire)
  const open = a.status === 'open'
  const ready = a.status === 'ready'
  const problem = a.kind === 'boss' ? bossProblem(a.config) : null
  const verb = a.kind === 'poll' ? 'Voting' : a.kind === 'cloud' ? 'Words' : 'The round'
  const unit = a.kind === 'boss' ? 'trying' : 'answered'

  return (
    <section aria-label={KIND_NAME[a.kind]} className="flex min-h-0 flex-1 flex-col">
      <div className="flex min-h-11 items-center gap-4">
        {countdown && <CountdownRing countdown={countdown} size="screen" />}
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
              <>
              {/* While it's open the slide can't change (lib/meet/slides.ts navBlocked): say how to move on. */}
              <span className="text-footnote text-ink-muted">{a.kind === 'boss' ? 'Close the round' : a.kind === 'poll' ? 'Close voting' : 'Close the cloud'} to move on</span>
              {countdown && (
                <Button variant="ghost" disabled={!!busy} onClick={() => call('extend_activity', { activity_id: a.id })} aria-label={`Add ${EXTEND_S} seconds`}>
                  +{EXTEND_S}s
                </Button>
              )}
              <Button size="md" icon={a.kind === 'boss' ? undefined : ArrowRight} disabled={!!busy} onClick={onClose} className="h-12! px-6! text-[17px]!">
                {a.kind === 'boss' ? 'Close the round' : a.kind === 'poll' ? 'Close voting' : 'Close the cloud'}
                {onResults !== undefined && <span className="sr-only">, then show the results</span>}
              </Button>
              </>
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
        {a.kind === 'poll' && <ScreenPoll activity={a} at={t ?? 0} />}
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
        {a.kind === 'poll' && <div className="max-w-[88rem]"><PollResultTiles activity={a} size="screen" final /></div>}
        {a.kind === 'cloud' && <WordCloud activity={a} />}
        {a.kind === 'boss' && <BossTally activity={a} participants={participants} verdict />}
      </div>
    </section>
  )
}

// ─── Poll: the voting tiles, counts hidden for the first 8 s ───

function ScreenPoll({ activity, at }: { activity: PublicActivity; at: number }) {
  const shown = pollRevealed(activity, at)
  const total = (activity.counts ?? []).reduce((n, c) => n + c, 0)
  return (
    <div className="max-w-[88rem]">
      <PollResultTiles activity={activity} size="screen" shown={shown} />
      {activity.status === 'open' && !shown && (
        <p className="mt-5 font-mono text-[16px] tabular text-ink-muted" aria-live="polite">
          {total} {total === 1 ? 'vote' : 'votes'} in · the counts show in a moment
        </p>
      )}
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
