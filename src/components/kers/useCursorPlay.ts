'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'

/** What Kers is doing about your cursor: pointing at what you hover, leaning in at a still pointer, or flinching when you hover him. */
export type CursorPlay = 'point' | 'lean' | 'flinch' | null

const NEAR = 400
const STILL_MS = 4000
const LEAN_EVERY_MS = 3 * 60_000
const LEAN_MS = 2400
const FLINCH_MS = 450

/**
 * Kers reacts to your real cursor (desktop, fine pointers only; never under
 * reduced motion, and only while `enabled`: not mid-chat, mid-focus, asleep
 * or out on a walk):
 *
 *  - hover a link, button or post within ~400px of him and he points at it
 *  - leave the pointer still for a few seconds and, at most every few
 *    minutes, he leans over to look at it
 *  - hover him and he flinches (cursor meets cursor)
 *
 * `anchor` is his corner; returns what he's doing now.
 */
export function useCursorPlay(anchor: RefObject<HTMLElement | null>, enabled: boolean): CursorPlay {
  const [play, setPlay] = useState<CursorPlay>(null)
  const lastMove = useRef(0)
  const lastLean = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (!enabled) return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const set = (next: CursorPlay, ms?: number) => {
      clearTimeout(timer.current)
      setPlay(next)
      if (ms) timer.current = setTimeout(() => setPlay(null), ms)
    }
    const near = (el: Element) => {
      const me = anchor.current?.getBoundingClientRect()
      if (!me) return false
      const r = el.getBoundingClientRect()
      return Math.hypot(r.left + r.width / 2 - (me.left + me.width / 2), r.top + r.height / 2 - (me.top + me.height / 2)) < NEAR
    }

    const onOver = (e: PointerEvent) => {
      const target = e.target as Element | null
      if (!target) return
      if (anchor.current?.contains(target)) { set('flinch', FLINCH_MS); return }
      const thing = target.closest('a[href], button, [role="button"], article')
      if (thing && near(thing)) set('point')
    }
    const onOut = (e: PointerEvent) => {
      const thing = (e.target as Element | null)?.closest('a[href], button, [role="button"], article')
      if (!thing) return
      setPlay(p => (p === 'point' ? null : p))
    }
    const onMove = () => { lastMove.current = Date.now() }
    const idle = setInterval(() => {
      const now = Date.now()
      if (!lastMove.current || now - lastMove.current < STILL_MS || now - lastLean.current < LEAN_EVERY_MS) return
      lastLean.current = now
      set('lean', LEAN_MS)
    }, 1000)

    document.addEventListener('pointerover', onOver)
    document.addEventListener('pointerout', onOut)
    document.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      clearInterval(idle)
      clearTimeout(timer.current)
      document.removeEventListener('pointerover', onOver)
      document.removeEventListener('pointerout', onOut)
      document.removeEventListener('pointermove', onMove)
      setPlay(null)
    }
  }, [anchor, enabled])

  return enabled ? play : null
}
