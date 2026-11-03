'use client'

import { useCallback, useEffect, useState } from 'react'
import type { MyDemo, Slot } from '@/lib/showtell'

export interface ShowTell {
  cycle: { id: string; label: string; meeting_at: string | null } | null
  spotlight: Slot | null
  demo: Slot | null
  mine: MyDemo[]
  passes_left: number
}

/* The board shows Show & Tell in two places (the rail and the invitation
   card), so one request feeds both; refresh() re-asks for everyone. */
let inflight: Promise<ShowTell | null> | null = null
const listeners = new Set<(s: ShowTell | null) => void>()

function load(): Promise<ShowTell | null> {
  inflight ??= fetch('/api/demos', { cache: 'no-store' })
    .then(r => (r.ok ? r.json() : null))
    .catch(() => null)
  return inflight
}

export function useShowTell() {
  const [data, setData] = useState<ShowTell | null>(null)

  useEffect(() => {
    let alive = true
    const set = (s: ShowTell | null) => { if (alive) setData(s) }
    listeners.add(set)
    load().then(set)
    return () => { alive = false; listeners.delete(set) }
  }, [])

  const refresh = useCallback(async () => {
    inflight = null
    const next = await load()
    listeners.forEach(l => l(next))
  }, [])

  return { data, refresh }
}
