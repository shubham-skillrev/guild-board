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
  if (!cycle || !isOpen(cycle)) return false
  if (!cycle.meeting_at) return false
  return isInteractionLocked(cycle)
}
