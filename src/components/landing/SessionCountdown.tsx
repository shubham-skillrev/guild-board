'use client'

import { useSyncExternalStore } from 'react'
import { cn } from '@/lib/utils/cn'

/**
 * "Next guild session in 9d 14h", live.
 *
 * Time can't be read during a server render without the client disagreeing on
 * hydration, so this reads the clock through useSyncExternalStore: the server
 * snapshot is null and renders the plain date (`fallback`), and the client
 * swaps in the countdown after hydration and ticks it every 30 seconds.
 */

const TICK_MS = 30_000
/** How long after the start the session still counts as happening. */
const LIVE_FOR_MS = 90 * 60_000

function subscribe(onChange: () => void) {
  const id = setInterval(onChange, TICK_MS)
  return () => clearInterval(id)
}
// Rounded to the tick, so repeated reads between ticks return the same value
// (useSyncExternalStore requires a stable snapshot).
const getNow = () => Math.floor(Date.now() / TICK_MS) * TICK_MS
const getServerNow = () => null

function formatLeft(ms: number): string {
  const m = Math.floor(ms / 60_000)
  const d = Math.floor(m / 1440)
  const h = Math.floor((m % 1440) / 60)
  const min = m % 60
  if (d > 0) return `${d}d ${h}h`
  if (h > 0) return `${h}h ${min}m`
  return `${Math.max(min, 1)}m`
}

export function SessionCountdown({
  meetingAt,
  fallback,
  className,
}: {
  meetingAt: string | null
  fallback: string
  className?: string
}) {
  const now = useSyncExternalStore(subscribe, getNow, getServerNow)

  let text = fallback
  let live = false
  if (meetingAt && now !== null) {
    const left = new Date(meetingAt).getTime() - now
    if (left > 0) text = `Next guild session in ${formatLeft(left)}`
    else if (left > -LIVE_FOR_MS) { text = 'Guild session happening now'; live = true }
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 h-8 pl-2.5 pr-3.5 rounded-full border border-border bg-paper text-[13px] text-ink-soft',
        className,
      )}
    >
      <span className="relative flex w-2 h-2" aria-hidden>
        <span className={cn('absolute inset-0 rounded-full bg-matcha', live && 'animate-ping opacity-60')} />
        <span className="relative w-2 h-2 rounded-full bg-matcha" />
      </span>
      {/* Announced once, not every tick. */}
      <span aria-live="off" className="tabular-nums">{text}</span>
    </span>
  )
}
