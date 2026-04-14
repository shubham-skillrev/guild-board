import type { Cycle } from '@/types'

export function isOpen(cycle: Cycle | null): boolean {
  return cycle?.status === 'open'
}

export function isInteractionLocked(cycle: Cycle | null): boolean {
  if (!cycle?.meeting_at) return false
  return new Date() >= new Date(cycle.meeting_at)
}

export function isFrozen(cycle: Cycle | null): boolean {
  return cycle?.status === 'frozen'
}

export function isClosed(cycle: Cycle | null): boolean {
  return cycle?.status === 'closed'
}

export function isSubmissionAllowed(cycle: Cycle | null): boolean {
  return isOpen(cycle) && !isInteractionLocked(cycle)
}

export function isVotingAllowed(cycle: Cycle | null): boolean {
  return isOpen(cycle) && !isInteractionLocked(cycle)
}

export function isSparkWindowActive(cycle: Cycle | null): boolean {
  if (!cycle) return false
  // Open cycle past meeting date
  if (isOpen(cycle) && cycle.meeting_at && isInteractionLocked(cycle)) return true
  // Closed cycle still within spark_closes_at window
  if (isClosed(cycle) && cycle.spark_closes_at && new Date() < new Date(cycle.spark_closes_at)) return true
  return false
}
