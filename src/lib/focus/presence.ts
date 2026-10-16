'use client'

import { useSyncExternalStore } from 'react'

/**
 * Who else has a focus timer running right now, anonymously (migration
 * 036): the little crowd on /focus. FocusPresence (mounted once in the
 * layout) owns the channel and writes here; /focus reads it. One channel per
 * browser tab, however many components want the count.
 *
 * Each browser shows up under a random key, kept for the day, carrying only
 * focusing or on a break, when that started (to the nearest ten seconds,
 * for break parties), and a number that picks its plush's colour. Nothing
 * that says who.
 */
export const FOCUS_CHANNEL = 'focus:guild'

export type WindowState = 'focus' | 'break'

/** What one browser shares while its timer runs. */
export interface Lit {
  s: WindowState
  since: number
  look: number
}

/** Someone in the crowd (you included, flagged). */
export interface Person extends Lit {
  key: string
  you: boolean
}

export interface Room {
  /** Signed in (the count is for members only). */
  member: boolean
  /** Joined the channel: the count is real. */
  connected: boolean
  people: Person[]
}

const EMPTY: Room = { member: false, connected: false, people: [] }
let room: Room = EMPTY
const listeners = new Set<() => void>()

export function setRoom(next: Partial<Room>) {
  room = { ...room, ...next }
  listeners.forEach(l => l())
}

// Dev only: fill the room by hand (window.__gbRoom({ people: [...] })) to see it busy.
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  (window as unknown as { __gbRoom: typeof setRoom }).__gbRoom = (next: Partial<Room>) => setRoom({ connected: true, ...next })
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

/** The crowd, live. */
export function useRoom(): Room {
  return useSyncExternalStore(subscribe, () => room, () => EMPTY)
}

const KEY = 'guildbot:focus:key'

/** This browser's key for the day (shared by its tabs, so one browser counts once). */
export function browserKey(): { key: string; look: number } {
  const today = new Date().toDateString()
  const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { key: string; look: number; day: string } | null
  if (saved?.day === today) return saved
  const fresh = { key: crypto.randomUUID(), look: Math.floor(Math.random() * 100), day: today }
  localStorage.setItem(KEY, JSON.stringify(fresh))
  return fresh
}

/** Three or more breaks that began within a minute of each other, still going. */
export function breakParty(people: Person[]): number {
  const starts = people.filter(p => p.s === 'break').map(p => p.since).sort((a, b) => a - b)
  let best = 0
  for (let i = 0; i < starts.length; i++) {
    let j = i
    while (j + 1 < starts.length && starts[j + 1] - starts[i] <= 60_000) j++
    best = Math.max(best, j - i + 1)
  }
  return best >= 3 ? best : 0
}
