import type { LineKey } from './lines.ts'

/**
 * Which welcome line the bubble above the chat button should use. Pure, so
 * the app decides only the facts and this decides the mood.
 *
 *  guest      not signed in
 *  upcoming   next month not open yet
 *  discussion posting closed, meeting time
 *  maxed      used every post this cycle
 *  posted     posted at least once
 *  deadline   no post yet, meeting within 3 days
 *  theme      no post yet, early in the month and it has a theme
 *  idle       no post yet, otherwise
 */
export interface WelcomeFacts {
  signedIn: boolean
  phase: 'upcoming' | 'open' | 'discussion'
  postsUsed: number
  postsAllowed: number
  /** Whole days to the meeting, or null if none is set. */
  daysToMeeting: number | null
  hasTheme: boolean
}

export function welcomeKey(f: WelcomeFacts): LineKey {
  if (!f.signedIn) return 'welcome.guest'
  if (f.phase === 'upcoming') return 'welcome.upcoming'
  if (f.phase === 'discussion') return 'welcome.discussion'
  if (f.postsUsed >= f.postsAllowed) return 'welcome.maxed'
  if (f.postsUsed > 0) return 'welcome.posted'
  if (f.daysToMeeting !== null && f.daysToMeeting <= 3) return 'welcome.deadline'
  if (f.hasTheme && (f.daysToMeeting === null || f.daysToMeeting > 10)) return 'welcome.theme'
  return 'welcome.idle'
}

/** "today", "tomorrow" or "in 3 days", for the deadline lines. */
export function meetingWhen(days: number): string {
  if (days <= 0) return 'today'
  if (days === 1) return 'tomorrow'
  return `in ${days} days`
}

/** ISO week, e.g. "2026-W41": the bubble changes once a week. */
export function isoWeek(d: Date): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
  const day = t.getUTCDay() || 7
  t.setUTCDate(t.getUTCDate() + 4 - day)
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1))
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7)
  return `${t.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}
