'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useToast } from '@/hooks/useToast'
import { meetingLive, type Meeting, type MeetingState } from '@/lib/meeting'
import type { RoomState } from '@/lib/meet/activity'
import { newerRoom, useMeetingChannel } from '@/components/meet/useMeetingChannel'

/** Without the live channel (or before it joins). */
const POLL_MS = 3000
/** With it: the room arrives by broadcast, the rest (prep edits, a take-over) can wait. */
const SLOW_POLL_MS = 15_000

/**
 * The live meeting for admin screens (the presenter screen, meeting mode):
 * the state from GET /api/admin/meeting, and one way to call the meeting API.
 *
 * The room (who's in, the segment's activity and its answers) arrives on the
 * private broadcast channel `meeting:{cycle_id}` at most once a second. A
 * broadcast that shows the meeting somewhere else (another admin moved the
 * segment, ended it) triggers a fetch at once. While the channel is down
 * the whole state is polled every 3 s; while it's up, every 15 s.
 *
 * The server's clock drives the timed bits (the poll's 8 s reveal, Kers' Boss
 * Round intro): `now()` is the browser's clock
 * corrected by the offset seen on the last response.
 */
export function useMeetingLive(initial: MeetingState) {
  const toast = useToast()
  const [state, setState] = useState(initial)
  const [busy, setBusy] = useState<string | null>(null)
  const skew = useRef(0)
  // Bumped by every write, so a poll that left before it can't undo it.
  const seq = useRef(0)
  // Writes still on their way: a poll sent now could read the meeting from
  // before them (a goto not yet saved) and flip the screen back, so none goes.
  const inflight = useRef(0)
  const cycleId = initial.cycle.id

  const accept = useCallback((next: MeetingState) => {
    skew.current = new Date(next.serverNow).getTime() - Date.now()
    // A broadcast may have brought a newer room than this response.
    setState(s => ({ ...next, room: next.room ? newerRoom(s.room, next.room) : next.room ?? null }))
  }, [])
  const latest = useRef(state)
  useEffect(() => { latest.current = state }, [state])

  useEffect(() => {
    skew.current = new Date(initial.serverNow).getTime() - Date.now()
  }, [initial.serverNow])

  const fetchNow = useRef<() => void>(() => {})

  const onRoom = useCallback((room: RoomState) => {
    const m = latest.current.meeting
    const moved = room.segment !== m.currentSegment || room.live !== meetingLive(m)
    setState(s => ({ ...s, room: newerRoom(s.room, room) }))
    if (moved) fetchNow.current()
  }, [])
  const { connected } = useMeetingChannel(cycleId, onRoom)

  useEffect(() => {
    let alive = true
    const tick = async () => {
      if (document.hidden || inflight.current > 0) return
      const mine = seq.current
      try {
        const res = await fetch(`/api/admin/meeting?cycle_id=${cycleId}`, { cache: 'no-store' })
        if (!res.ok || !alive || mine !== seq.current) return
        accept(await res.json())
      } catch {
        /* offline for a moment: the next tick tries again */
      }
    }
    fetchNow.current = tick
    const t = setInterval(tick, connected ? SLOW_POLL_MS : POLL_MS)
    document.addEventListener('visibilitychange', tick)
    return () => {
      alive = false
      clearInterval(t)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [cycleId, accept, connected])

  /** Patch the meeting on screen now, before the server answers. */
  const optimistic = useCallback((patch: Partial<Meeting>) => {
    seq.current++
    setState(s => ({ ...s, meeting: { ...s.meeting, ...patch } }))
  }, [])

  const call = useCallback(
    async <T = Partial<MeetingState>>(action: string, payload: Record<string, unknown> = {}, done?: string): Promise<T | null> => {
      const mine = ++seq.current
      inflight.current++
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
        inflight.current--
        setBusy(null)
      }
    },
    [cycleId, accept, toast],
  )

  const now = useCallback(() => Date.now() + skew.current, [])

  return { state, meeting: state.meeting, busy, call, optimistic, now, live: connected }
}

/**
 * The time, ticking once a second while `on` (the presenter screen uses it
 * for Kers' Boss Round intro; nothing on screen shows a clock). Starts from
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
