/** A member's first two weeks: the board shows Kers' getting-started card. */
export const ONBOARDING_DAYS = 14

export type OnboardingStep = 'survey' | 'vote' | 'speak' | 'notifications' | 'app'

export interface Onboarding {
  show: boolean
  done: Record<OnboardingStep, boolean>
}

export function isNewMember(createdAt: string | null | undefined): boolean {
  return !!createdAt && Date.now() - new Date(createdAt).getTime() < ONBOARDING_DAYS * 86_400_000
}
