'use client'

import { useEffect, useRef, useState } from 'react'
import { cn } from '@/lib/utils/cn'
import type { PublicActivity } from '@/lib/meet/activity'
import { formatClock, fractionLeft, remainingMs, ringHeat, ringStage, totalMs, type RingStage } from '@/lib/meet/timer'

/** How often the ring redraws. */
const TICK_MS = 250
/** At zero, the client asks the server again this often until it says closed (the server decides). */
const RETRY_MS = 2000
/** The warm end of the ring: yellow, turning to vermillion (a status colour, not the saffron accent). */
const YELLOW = '#D9A21B'

export interface Countdown {
  /** Milliseconds left (0 at the end). */
  left: number
  /** The ring's whole length (opened to closes). */
  total: number | null
  stage: RingStage
  /** 0..1: how far yellow has turned red. */
  heat: number
  timeUp: boolean
}

type Timed = Pick<PublicActivity, 'status' | 'openedAt' | 'closesAt'>

/**
 * An open activity's countdown (lib/meet/timer.ts), from the server's
 * `closesAt` and `now()` (the browser's clock corrected by the server's).
 * Null when it isn't open or isn't timed (before migration 048). At zero it
 * calls `onExpire` (pull the room: the server closes it on that read), again
 * every 2 s until the activity stops being open.
 */
export function useCountdown(a: Timed | null | undefined, now: () => number, onExpire?: () => void): Countdown | null {
  const on = !!a && a.status === 'open' && !!a.closesAt
  const [t, setT] = useState<number | null>(null)
  useEffect(() => {
    if (!on) return
    const tick = () => setT(now())
    const first = setTimeout(tick, 0)
    const id = setInterval(tick, TICK_MS)
    return () => {
      clearTimeout(first)
      clearInterval(id)
    }
  }, [on, now])

  const left = on && t !== null ? remainingMs(a!.closesAt, t) : null
  const fired = useRef(-Infinity)
  useEffect(() => {
    if (left !== 0 || t === null || !onExpire || t - fired.current < RETRY_MS) return
    fired.current = t
    onExpire()
  }, [left, t, onExpire])

  if (left === null) return null
  const total = totalMs(a!.openedAt, a!.closesAt)
  return { left, total, stage: ringStage(left, total), heat: ringHeat(left, total), timeUp: left === 0 }
}

const SIZES = {
  phone: { box: 40, stroke: 3, text: 'text-[11px]' },
  screen: { box: 56, stroke: 3.5, text: 'text-[14px]' },
} as const

/**
 * The countdown ring: a thin circle that empties as time runs out, m:ss in
 * the middle. Quiet ink until the last 20%, then yellow warming to red.
 * Small on phones, modest on the shared screen. Under reduced motion it
 * steps instead of gliding.
 */
export function CountdownRing({ countdown, size, className }: { countdown: Countdown; size: 'phone' | 'screen'; className?: string }) {
  const { box, stroke, text } = SIZES[size]
  const r = (box - stroke) / 2
  const c = 2 * Math.PI * r
  const f = fractionLeft(countdown.left, countdown.total)
  const clock = formatClock(countdown.left)
  const colour =
    countdown.stage === 'calm' ? 'var(--color-ink-soft)' : `color-mix(in oklab, ${YELLOW}, var(--color-vermillion) ${Math.round(countdown.heat * 100)}%)`
  return (
    <div role="timer" aria-label={countdown.timeUp ? 'Time’s up' : `${clock} left`} className={cn('relative inline-grid shrink-0 place-items-center', className)} style={{ width: box, height: box }}>
      <svg aria-hidden width={box} height={box} viewBox={`0 0 ${box} ${box}`} className="-rotate-90">
        <circle cx={box / 2} cy={box / 2} r={r} fill="none" stroke="var(--color-fill-strong)" strokeWidth={stroke} />
        <circle
          cx={box / 2}
          cy={box / 2}
          r={r}
          fill="none"
          stroke={colour}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - f)}
          className="transition-[stroke-dashoffset,stroke] duration-300 ease-linear motion-reduce:transition-none"
        />
      </svg>
      <span aria-hidden className={cn('absolute font-mono font-medium tabular leading-none', text, countdown.timeUp ? 'text-vermillion' : 'text-ink')}>
        {clock}
      </span>
    </div>
  )
}
