'use client'

import { useEffect, useState } from 'react'
import { Play } from '@phosphor-icons/react/dist/ssr'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'
import { POLL_REVEAL_MS, pollRevealed, type ActivityKind, type PublicActivity } from '@/lib/meet/activity'
import type { MeetingState, Segment } from '@/lib/meeting'

const KIND_NAME: Record<ActivityKind, string> = { poll: 'Poll', cloud: 'Word cloud', boss: 'Boss Round' }

type Call = (action: string, payload?: Record<string, unknown>, done?: string) => Promise<unknown>

/**
 * The segment's activity on the presenter screen (docs/06-meeting-mode.md),
 * between the segment's heading and Kers' prep:
 *
 *   ready   the prompt, and for the presenter the one "Open" button
 *   open    the answers as they come in: poll bars (hidden for the first
 *           8 s, so the first votes don't steer the rest) or the word cloud
 *           (live from the start); how many of the room answered
 *   closed  the final result; the presenter may open it again
 *
 * Moving to another segment closes it (the API does). Everything here is
 * counts and words: nothing names anyone. The body switches on the kind, so
 * Phase 3 adds its `boss` renderer below without touching the rest.
 */
export function ActivityPanel({
  segment,
  state,
  presenting,
  now,
  call,
  busy,
}: {
  segment: Segment
  state: MeetingState
  presenting: boolean
  now: () => number
  call: Call
  busy: string | null
}) {
  const room = state.room
  const a = room?.activity
  const t = useTicking(!!a && a.status === 'open' && a.kind === 'poll', now)
  if (!room || !a || a.segmentId !== segment.id) return null

  const open = a.status === 'open'
  const status =
    a.status === 'ready' ? 'not open yet'
    : open ? `${a.answered} of ${room.participants} answered`
    : `closed · ${a.answered} answered`

  return (
    <section aria-label={KIND_NAME[a.kind]} className="mt-8 max-w-[72rem] rounded-[20px] border border-border bg-paper px-6 py-5">
      <div className="flex items-center gap-3">
        <p className="font-mono text-[13px] uppercase tracking-[0.18em] text-ink-muted">
          {KIND_NAME[a.kind]} · <span className="tabular">{status}</span>
        </p>
        {presenting && (
          <div className="ml-auto flex gap-2">
            {a.status === 'ready' && (
              <Button variant="secondary" icon={Play} disabled={!!busy} onClick={() => call('open_activity', { activity_id: a.id })}>
                {busy === 'open_activity' ? 'Opening…' : `Open the ${KIND_NAME[a.kind].toLowerCase()}`}
              </Button>
            )}
            {open && (
              <Button variant="ghost" disabled={!!busy} onClick={() => call('close_activity', { activity_id: a.id })}>Close</Button>
            )}
            {a.status === 'closed' && (
              <Button variant="ghost" disabled={!!busy} onClick={() => call('open_activity', { activity_id: a.id })}>Open again</Button>
            )}
          </div>
        )}
      </div>
      <p className="mt-3 text-[clamp(22px,1.8vw,32px)] font-medium leading-snug tracking-[-0.015em] text-ink text-balance">{a.prompt}</p>
      {open && <p className="mt-1 text-[15px] text-ink-muted">On your phone or laptop: open GuildBoard and join the room.</p>}
      <div className="mt-6">
        <ActivityBody activity={a} at={t ?? 0} />
      </div>
    </section>
  )
}

/** The answers, by kind. */
function ActivityBody({ activity, at }: { activity: PublicActivity; at: number }) {
  switch (activity.kind) {
    case 'poll':
      return <PollBars activity={activity} at={at} />
    case 'cloud':
      return <WordCloud activity={activity} />
    case 'boss':
      // Phase 3: the pass rate and how many are trying, from activity.tally.
      return <p className="text-[17px] text-ink-muted">Kers is still writing the problems.</p>
  }
}

function PollBars({ activity, at }: { activity: PublicActivity; at: number }) {
  const counts = activity.counts ?? activity.options.map(() => 0)
  const total = counts.reduce((n, c) => n + c, 0)
  const shown = activity.status !== 'ready' && pollRevealed(activity, at)
  const wait = activity.openedAt ? Math.ceil((POLL_REVEAL_MS - (at - new Date(activity.openedAt).getTime())) / 1000) : 0
  return (
    <div>
      <ul className="space-y-3">
        {activity.options.map((o, i) => {
          const share = shown && total ? counts[i] / total : 0
          return (
            <li key={i}>
              <div className="flex items-baseline gap-3 text-[clamp(17px,1.25vw,22px)]">
                <span className="min-w-0 flex-1 text-ink">{o}</span>
                {shown && (
                  <span className="shrink-0 font-mono tabular text-ink-muted">
                    {Math.round(share * 100)}% · {counts[i]}
                  </span>
                )}
              </div>
              <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-kinu/70">
                <div
                  className="h-full rounded-full bg-ink transition-[width] duration-700 ease-out motion-reduce:transition-none"
                  style={{ width: `${share * 100}%` }}
                />
              </div>
            </li>
          )
        })}
      </ul>
      {activity.status === 'open' && !shown && (
        <p className="mt-4 font-mono text-[15px] tabular text-ink-muted" aria-live="polite">
          {total} {total === 1 ? 'vote' : 'votes'} in · results in {Math.max(1, wait)} s
        </p>
      )}
    </div>
  )
}

function WordCloud({ activity }: { activity: PublicActivity }) {
  const words = activity.words ?? []
  if (!words.length) {
    return <p className="text-[17px] text-ink-muted">{activity.status === 'ready' ? 'Words land here once it opens.' : 'Waiting for the first word…'}</p>
  }
  const max = words[0].n
  return (
    <ul className="flex flex-wrap items-baseline justify-center gap-x-6 gap-y-2 py-2" aria-label="Words so far">
      {words.map((w, i) => {
        const weight = max > 1 ? (w.n - 1) / (max - 1) : 1
        return (
          <li
            key={w.word}
            className={cn(
              'leading-tight tracking-[-0.02em] transition-[font-size] duration-500 motion-reduce:transition-none',
              weight > 0.6 ? 'font-semibold text-ink' : weight > 0.25 ? 'font-medium text-ink' : 'text-ink-soft',
            )}
            style={{ fontSize: `${Math.round(18 + weight * 46)}px`, order: i % 2 ? i : -i }}
          >
            {w.word}
            {w.n > 1 && <span className="sr-only"> ({w.n})</span>}
          </li>
        )
      })}
    </ul>
  )
}

/** The server's time, ticking twice a second while `on` (for the 8 s reveal). */
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
