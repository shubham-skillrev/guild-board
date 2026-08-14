'use client'

/**
 * One floating slot above the bottom nav, and one occupant at a time.
 *
 * Before this, four fixed elements decided independently whether to appear.
 * `InstallPrompt` and `PushOptIn` used identical coordinates, so when both were
 * eligible the push prompt was not queued behind the install prompt, it was
 * simply covered by it. `MeetingPill` sat in the same corner on top of both.
 *
 * Each candidate registers a priority and only the highest live claim renders.
 * Toasts are deliberately outside this: they are transient, they never block a
 * control, and something must be able to confirm an action taken from whatever
 * is currently in the slot.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'

/** Higher wins. Timely and dismissable beats persistent and promotional. */
export const OVERLAY_PRIORITY = {
  meetingPill: 30,
  pushOptIn: 20,
  installPrompt: 10,
} as const

type Claims = Record<string, number>

const OverlayCtx = createContext<{
  claims: Claims
  claim: (id: string, priority: number | null) => void
} | null>(null)

export function OverlaySlotProvider({ children }: { children: React.ReactNode }) {
  const [claims, setClaims] = useState<Claims>({})

  const claim = useCallback((id: string, priority: number | null) => {
    setClaims(prev => {
      if (priority === null) {
        if (!(id in prev)) return prev
        const next = { ...prev }
        delete next[id]
        return next
      }
      if (prev[id] === priority) return prev
      return { ...prev, [id]: priority }
    })
  }, [])

  const value = useMemo(() => ({ claims, claim }), [claims, claim])
  return <OverlayCtx.Provider value={value}>{children}</OverlayCtx.Provider>
}

/**
 * Returns true only when this candidate both wants the slot and outranks every
 * other live claim. Without a provider it fails open, so a component rendered
 * outside the tree still works rather than silently vanishing.
 */
export function useOverlaySlot(id: string, priority: number, wants: boolean): boolean {
  const ctx = useContext(OverlayCtx)
  const claim = ctx?.claim

  useEffect(() => {
    if (!claim) return
    claim(id, wants ? priority : null)
    return () => claim(id, null)
  }, [claim, id, priority, wants])

  if (!ctx) return wants
  if (!wants) return false

  let topId: string | null = null
  let topPriority = -Infinity
  for (const [claimId, claimPriority] of Object.entries(ctx.claims)) {
    if (claimPriority > topPriority) {
      topPriority = claimPriority
      topId = claimId
    }
  }
  return topId === id
}
