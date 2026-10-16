'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'

/**
 * The focus timer: work blocks with GuildBot, and the breaks he leads.
 *
 * Lives in this browser only (localStorage), so it keeps running while you
 * move around the app, and nothing about your habits ever reaches the server
 * or anyone else. One timer per browser; tabs share it.
 *
 * Phases go idle → focus → break → idle. FocusAlerts (mounted once in the
 * layout) is the only thing that moves a finished phase on, so a block is
 * counted once however many components are watching.
 */
export type Plan = 'pomodoro' | 'deep' | 'long'
export type BreakKind = 'water' | 'eyes' | 'stretch' | 'walk'
export type Phase = 'idle' | 'focus' | 'break'

export const PLANS: Record<Plan, { label: string; focus: number; rest: number }> = {
  pomodoro: { label: 'Pomodoro', focus: 25, rest: 5 },
  deep: { label: 'Deep work', focus: 50, rest: 10 },
  long: { label: 'Long haul', focus: 90, rest: 20 },
}

/** The breaks he leads, and how long each guided bit takes (water is a sip). */
export const BREAKS: Record<BreakKind, { label: string; seconds: number }> = {
  water: { label: 'Water', seconds: 0 },
  eyes: { label: 'Eyes, 20s', seconds: 20 },
  stretch: { label: 'Stretch, 1 min', seconds: 60 },
  walk: { label: 'Walk, 5 min', seconds: 300 },
}

export interface FocusState {
  plan: Plan
  phase: Phase
  /** When the current phase ends; null when idle or paused. */
  endsAt: number | null
  /** Paused with this much left. */
  pausedLeft: number | null
  /** The break he's leading, and when its guided bit ends. */
  breakKind: BreakKind | null
  guideEndsAt: number | null
}

export interface FocusDay {
  day: string
  focusMinutes: number
  blocks: number
  breaks: Record<BreakKind, number>
}

const KEY = 'guildbot:focus'
const STATS = 'guildbot:focus:stats'
const EVENT = 'gb:focus'
const IDLE: FocusState = { plan: 'pomodoro', phase: 'idle', endsAt: null, pausedLeft: null, breakKind: null, guideEndsAt: null }

let cache: { raw: string | null; state: FocusState } = { raw: null, state: IDLE }
function read(): FocusState {
  const raw = localStorage.getItem(KEY)
  if (raw !== cache.raw) cache = { raw, state: raw ? { ...IDLE, ...JSON.parse(raw) } : IDLE }
  return cache.state
}
function write(next: FocusState) {
  localStorage.setItem(KEY, JSON.stringify(next))
  window.dispatchEvent(new Event(EVENT))
}
function subscribe(cb: () => void) {
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) cb() }
  window.addEventListener(EVENT, cb)
  window.addEventListener('storage', onStorage)
  return () => { window.removeEventListener(EVENT, cb); window.removeEventListener('storage', onStorage) }
}

/** The timer, live across components and tabs. */
export function useFocusState(): FocusState {
  return useSyncExternalStore(subscribe, read, () => IDLE)
}

/** Milliseconds left in the phase (or the guided break bit), ticking. */
export function useRemaining(until: number | null, paused: number | null = null): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!until) return
    const id = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(id)
  }, [until])
  if (paused !== null) return paused
  return until ? Math.max(0, until - now) : 0
}

export function formatClock(ms: number): string {
  const s = Math.ceil(ms / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

const SUGGEST: BreakKind[] = ['water', 'eyes', 'stretch', 'walk']

export const focus = {
  setPlan(plan: Plan) {
    const s = read()
    if (s.phase === 'idle') write({ ...s, plan })
  },
  start() {
    const s = read()
    write({ ...s, phase: 'focus', endsAt: Date.now() + PLANS[s.plan].focus * 60_000, pausedLeft: null, breakKind: null, guideEndsAt: null })
  },
  pause() {
    const s = read()
    if (!s.endsAt) return
    write({ ...s, endsAt: null, pausedLeft: Math.max(0, s.endsAt - Date.now()) })
  },
  resume() {
    const s = read()
    if (s.pausedLeft === null) return
    write({ ...s, endsAt: Date.now() + s.pausedLeft, pausedLeft: null })
  },
  reset() {
    write({ ...IDLE, plan: read().plan })
  },
  /** End the current phase now (counts like finishing it). */
  skip() {
    const s = read()
    if (s.phase !== 'idle') focus.finish(s.endsAt ?? Date.now(), true)
  },
  /** Pick a break: he starts doing it, with its guided timer. */
  pickBreak(kind: BreakKind) {
    const s = read()
    const seconds = BREAKS[kind].seconds
    write({ ...s, breakKind: kind, guideEndsAt: seconds ? Date.now() + seconds * 1000 : null })
    bumpBreak(kind)
  },
  /**
   * Move a finished phase on. Only acts if `endsAt` is still the phase that
   * ended, so a second caller (another tab) does nothing.
   */
  finish(endsAt: number, early = false): Phase | null {
    const s = read()
    if (s.phase === 'idle' || (!early && s.endsAt !== endsAt)) return null
    if (s.phase === 'focus') {
      const minutes = early ? Math.round((PLANS[s.plan].focus * 60_000 - Math.max(0, (s.endsAt ?? Date.now()) - Date.now())) / 60_000) : PLANS[s.plan].focus
      bumpFocus(minutes)
      const kind = SUGGEST[todayStats().blocks % SUGGEST.length]
      write({ ...s, phase: 'break', endsAt: Date.now() + PLANS[s.plan].rest * 60_000, pausedLeft: null, breakKind: kind, guideEndsAt: null })
      return 'focus'
    }
    write({ ...IDLE, plan: s.plan })
    return 'break'
  },
}

function today(): string {
  return new Date().toDateString()
}

export function todayStats(): FocusDay {
  const saved = JSON.parse(localStorage.getItem(STATS) ?? 'null') as FocusDay | null
  return saved?.day === today() ? saved : { day: today(), focusMinutes: 0, blocks: 0, breaks: { water: 0, eyes: 0, stretch: 0, walk: 0 } }
}

function saveStats(d: FocusDay) {
  localStorage.setItem(STATS, JSON.stringify(d))
  window.dispatchEvent(new Event(EVENT))
}

function bumpFocus(minutes: number) {
  const d = todayStats()
  saveStats({ ...d, focusMinutes: d.focusMinutes + Math.max(0, minutes), blocks: d.blocks + 1 })
}

function bumpBreak(kind: BreakKind) {
  const d = todayStats()
  saveStats({ ...d, breaks: { ...d.breaks, [kind]: d.breaks[kind] + 1 } })
}

/** Today's numbers, live. */
export function useTodayStats(): FocusDay | null {
  const [stats, setStats] = useState<FocusDay | null>(null)
  useEffect(() => {
    const load = () => setStats(todayStats())
    const first = setTimeout(load, 0)
    window.addEventListener(EVENT, load)
    return () => { clearTimeout(first); window.removeEventListener(EVENT, load) }
  }, [])
  return stats
}
