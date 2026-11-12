'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useToast } from '@/hooks/useToast'
import type { Meeting, MeetingState } from '@/lib/meeting'

const POLL_MS = 3000

/**
 * The live meeting for admin screens (the presenter screen, meeting mode):
 * the state from GET /api/admin/meeting, refreshed every 3 s while the tab
 * is visible, and one way to call the meeting API.
 *
 * Phase 1 polls only. Phase 2 adds the private broadcast channel
 * `meeting:{id}` here (subscribe, then setState on each message) and keeps
 * this poll as the fallback for when the channel fails, so the screens that
 * use this hook don't change.
 *
 * The server's clock drives every countdown: `now()` is the browser's clock
 * corrected by the offset seen on the last response.
 */
export function useMeetingLive(initial: MeetingState) {
  const toast = useToast()
  const [state, setState] = useState(initial)
  const [busy, setBusy] = useState<string | null>(null)
  const skew = useRef(0)
  // Bumped by every write, so a poll that left before it can't undo it.
  const seq = useRef(0)
  const cycleId = initial.cycle.id

  const accept = useCallback((next: MeetingState) => {
    skew.current = new Date(next.serverNow).getTime() - Date.now()
    setState(next)
  }, [])

  useEffect(() => {
    skew.current = new Date(initial.serverNow).getTime() - Date.now()
  }, [initial.serverNow])

  useEffect(() => {
    let alive = true
    const tick = async () => {
      if (document.hidden) return
      const mine = seq.current
      try {
        const res = await fetch(`/api/admin/meeting?cycle_id=${cycleId}`, { cache: 'no-store' })
        if (!res.ok || !alive || mine !== seq.current) return
        accept(await res.json())
      } catch {
        /* offline for a moment: the next tick tries again */
      }
    }
    const t = setInterval(tick, POLL_MS)
    document.addEventListener('visibilitychange', tick)
    return () => {
      alive = false
      clearInterval(t)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [cycleId, accept])

  /** Patch the meeting on screen now, before the server answers. */
  const optimistic = useCallback((patch: Partial<Meeting>) => {
    seq.current++
    setState(s => ({ ...s, meeting: { ...s.meeting, ...patch } }))
  }, [])

  const call = useCallback(
    async <T = Partial<MeetingState>>(action: string, payload: Record<string, unknown> = {}, done?: string): Promise<T | null> => {
      const mine = ++seq.current
      setBusy(action)
      try {
        const res = await fetch('/api/admin/meeting', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, cycle_id: cycleId, ...payload }),
        })
        const data = await res.json().catch(() => ({}))
        // A refused move still says where the meeting really is.
        if (data?.meeting && mine === seq.current) {
          if (data.cycle && data.serverNow) accept(data as MeetingState)
          else setState(s => ({ ...s, meeting: data.meeting }))
        }
        if (!res.ok) throw new Error(data.error ?? 'Could not do that')
        if (done) toast(done, 'success')
        return data as T
      } catch (err) {
        toast(err instanceof Error ? err.message : 'Could not do that', 'error')
        return null
      } finally {
        setBusy(null)
      }
    },
    [cycleId, accept, toast],
  )

  const now = useCallback(() => Date.now() + skew.current, [])

  return { state, meeting: state.meeting, busy, call, optimistic, now }
}

/**
 * The time, ticking once a second while `on`, for countdowns. Starts from
 * `from` (the server's time in the page's props) so the server render and
 * the first client render agree.
 */
export function useSecond(on: boolean, now: () => number, from: string): number {
  const [t, setT] = useState(() => new Date(from).getTime())
  useEffect(() => {
    if (!on) return
    const id = setInterval(() => setT(now()), 1000)
    const first = setTimeout(() => setT(now()), 0)
    return () => {
      clearInterval(id)
      clearTimeout(first)
    }
  }, [on, now])
  return t
}
