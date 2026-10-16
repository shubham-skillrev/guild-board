'use client'

import { useSyncExternalStore } from 'react'

/**
 * The focus building's windows: who else has a timer running right now,
 * anonymously (migration 036). FocusPresence (mounted once in the layout)
 * owns the channel and writes here; /focus reads it. One channel per
 * browser tab, however many components want the windows.
 *
 * Each browser shows up under a random key, kept for the day, carrying only
 * what a window needs: focusing or on a break, when that started (to the
 * nearest ten seconds, for break parties), and a number that picks the
 * plush in the window. Nothing that says who.
 */
export const FOCUS_CHANNEL = 'focus:guild'

export type WindowState = 'focus' | 'break'

/** What one browser shares while its timer runs. */
export interface Lit {
  s: WindowState
  since: number
  look: number
}

/** A lit window as the building draws it. */
export interface Person extends Lit {
  key: string
  you: boolean
}

export interface Room {
  /** Signed in (the windows are for members only). */
  member: boolean
  /** Joined the channel: the windows are real. */
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

// Dev only: fill the building by hand (window.__gbRoom({ people: [...] })) to see it busy.
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  (window as unknown as { __gbRoom: typeof setRoom }).__gbRoom = (next: Partial<Room>) => setRoom({ connected: true, ...next })
}

function subscribe(cb: () => void) {
  listeners.add(cb)
  return () => { listeners.delete(cb) }
}

/** The building's windows, live. */
export function useRoom(): Room {
  return useSyncExternalStore(subscribe, () => room, () => EMPTY)
}

const KEY = 'guildbot:focus:key'

/** This browser's key for the day (shared by its tabs, so one browser is one window). */
export function browserKey(): { key: string; look: number } {
  const today = new Date().toDateString()
  const saved = JSON.parse(localStorage.getItem(KEY) ?? 'null') as { key: string; look: number; day: string } | null
  if (saved?.day === today) return saved
  const fresh = { key: crypto.randomUUID(), look: Math.floor(Math.random() * 100), day: today }
  localStorage.setItem(KEY, JSON.stringify(fresh))
  return fresh
}

/**
 * Give each person a window (0 to slots - 1) that stays put while others come
 * and go: a preferred window from their key, the next free one if taken.
 * Anyone past the last window is counted, not drawn.
 */
export function seat(people: Person[], slots: number): { windows: (Person | null)[]; overflow: number } {
  const windows: (Person | null)[] = Array(slots).fill(null)
  // You first, so your window is never the one that overflows.
  const ordered = [...people].sort((a, b) => Number(b.you) - Number(a.you) || a.key.localeCompare(b.key))
  let overflow = 0
  for (const p of ordered) {
    let i = hash(p.key) % slots
    let tries = 0
    while (windows[i] && tries < slots) { i = (i + 1) % slots; tries++ }
    if (windows[i]) overflow++
    else windows[i] = p
  }
  return { windows, overflow }
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

function hash(s: string): number {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) }
  return h >>> 0
}
