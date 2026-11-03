'use client'

import { useCallback, useEffect, useState } from 'react'
import type { RadarItem } from '@/lib/radar'

export interface RadarData {
  cycle: { id: string; label: string } | null
  items: RadarItem[]
}

/** This month's Radar, with optimistic votes. */
export function useRadar() {
  const [data, setData] = useState<RadarData | null>(null)

  const load = useCallback(() => {
    fetch('/api/radar', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => d && setData(d))
      .catch(() => {})
  }, [])

  useEffect(load, [load])

  const vote = useCallback(async (item: RadarItem) => {
    const flip = (i: RadarItem) =>
      i.id === item.id ? { ...i, voted: !i.voted, votes: i.votes + (i.voted ? -1 : 1) } : i
    setData(d => (d ? { ...d, items: d.items.map(flip) } : d))
    const res = await fetch(
      item.kind === 'link' ? `/api/radar/${item.id}/vote` : '/api/byte-interests',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: item.kind === 'link' ? undefined : JSON.stringify({ byte_id: item.id }),
      },
    ).catch(() => null)
    // Put it back if the vote didn't land.
    if (!res?.ok) setData(d => (d ? { ...d, items: d.items.map(flip) } : d))
  }, [])

  return { data, reload: load, vote }
}
