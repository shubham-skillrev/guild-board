'use client'

import { useState } from 'react'
import { useToast } from '@/hooks/useToast'
import type { Meeting } from '@/lib/meeting'

/** The meeting row plus one way to call the meeting API, for the Run tab. */
export function useMeeting(initial: Meeting) {
  const toast = useToast()
  const [meeting, setMeeting] = useState(initial)
  const [busy, setBusy] = useState<string | null>(null)

  const call = async <T = { meeting?: Meeting }>(action: string, payload: Record<string, unknown> = {}, done?: string): Promise<T | null> => {
    setBusy(action)
    try {
      const res = await fetch('/api/admin/meeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, cycle_id: meeting.cycleId, ...payload }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not do that')
      if (data.meeting) setMeeting(data.meeting)
      if (done) toast(done, 'success')
      return data as T
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not do that', 'error')
      return null
    } finally {
      setBusy(null)
    }
  }

  return { meeting, busy, call }
}
