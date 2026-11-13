'use client'

import { useSyncExternalStore } from 'react'

const POLL_MS = 60_000

export interface MeetLive {
  live: boolean
  /** The month ("November"). */
  label: string | null
  /** The slide on the shared screen (its title, else its section). */
  slide: string | null
}

const OFF: MeetLive = { live: false, label: null, slide: null }

/*
 * One poll of GET /api/meet/live for the whole page, however many things
 * ask (the live banner, board Kers): on the first subscriber, once a minute
 * while the tab is visible, and whenever the tab comes back. Stops when the
 * last one leaves.
 */
let state: MeetLive = OFF
const listeners = new Set<() => void>()
let timer: ReturnType<typeof setInterval> | null = null

function check() {
  if (typeof document !== 'undefined' && document.hidden) return
  fetch('/api/meet/live', { cache: 'no-store' })
    .then(r => (r.ok ? r.json() : null))
    .then(d => {
      if (!d) return
      const next: MeetLive = { live: !!d.live, label: d.label ?? null, slide: d.slide ?? null }
      if (next.live === state.live && next.label === state.label && next.slide === state.slide) return
      state = next
      listeners.forEach(l => l())
    })
    .catch(() => {})
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (listeners.size === 1) {
    check()
    timer = setInterval(check, POLL_MS)
    document.addEventListener('visibilitychange', check)
  }
  return () => {
    listeners.delete(listener)
    if (!listeners.size) {
      if (timer) clearInterval(timer)
      timer = null
      document.removeEventListener('visibilitychange', check)
    }
  }
}

/** Whether this month's meeting is live (never a rehearsal), and its current slide. */
export function useMeetLive(): MeetLive {
  return useSyncExternalStore(subscribe, () => state, () => OFF)
}
