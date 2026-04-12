import type { Cycle } from '@/types'
import { SPARK_WINDOW_HOURS } from '@/lib/constants'

export function isOpen(cycle: Cycle | null): boolean {
  return cycle?.status === 'open'
}

export function isFrozen(cycle: Cycle | null): boolean {
  return cycle?.status === 'frozen'
}

export function isClosed(cycle: Cycle | null): boolean {
  return cycle?.status === 'closed'
}

export function isSubmissionAllowed(cycle: Cycle | null): boolean {
  return isOpen(cycle)
}

export function isVotingAllowed(cycle: Cycle | null): boolean {
  return isOpen(cycle)
}

export function isSparkWindowActive(cycle: Cycle | null): boolean {
  if (!cycle || cycle.status !== 'closed') return false
  if (!cycle.spark_closes_at) return false
  return new Date() < new Date(cycle.spark_closes_at)
}
