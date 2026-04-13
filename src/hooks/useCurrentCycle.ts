'use client'

import { useEffect, useState } from 'react'
import type { Cycle } from '@/types'
import { isInteractionLocked } from '@/lib/utils/cycle'

export type CyclePhase = 'upcoming' | 'open' | 'discussion'

interface CycleState {
  cycle: Cycle | null
  phase: CyclePhase
  isLoading: boolean
}

export function useCurrentCycle() {
  const [state, setState] = useState<CycleState>({
    cycle: null,
    phase: 'upcoming',
    isLoading: true,
  })

  useEffect(() => {
    fetch('/api/cycles')
      .then(res => res.json())
      .then((cycle: Cycle | null) => {
        let phase: CyclePhase = 'upcoming'
        if (cycle) {
          if (cycle.status === 'upcoming') phase = 'upcoming'
          else phase = isInteractionLocked(cycle) ? 'discussion' : 'open'
        }
        setState({ cycle, phase, isLoading: false })
      })
      .catch(() => setState(s => ({ ...s, isLoading: false })))
  }, [])

  return state
}
