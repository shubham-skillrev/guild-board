import type { BoardStats, Mood } from './types.ts'

/**
 * The bot's mood, from board counts alone. It sets which lines get used.
 *
 *  - dramatic: three or more days in and no human has posted
 *  - bored:    some posts, but fewer than one every two days
 *  - proud:    humans have out-posted the bot
 *  - smug:     everything else, which is most days early in a month
 */
export function moodFor(stats: BoardStats): Mood {
  const { daysSinceOpen, humanPosts, botPosts } = stats
  if (humanPosts === 0) return daysSinceOpen >= 3 ? 'dramatic' : 'smug'
  if (humanPosts > botPosts) return 'proud'
  if (daysSinceOpen >= 4 && humanPosts / daysSinceOpen < 0.5) return 'bored'
  return 'smug'
}

export type DroughtTier = 'drought.smug' | 'drought.dramatic' | 'drought.meltdown'

/**
 * Which drought message is due, if any. Day 3 smug, day 6 dramatic, and the
 * meltdown on day 9 or four days before the meeting, whichever comes first.
 * The caller records what it has sent so each tier fires once per cycle.
 */
export function droughtTier(stats: BoardStats): DroughtTier | null {
  if (stats.humanPosts > 0) return null
  const nearMeeting = stats.daysToMeeting !== null && stats.daysToMeeting <= 4
  if (stats.daysSinceOpen >= 9 || (nearMeeting && stats.daysSinceOpen >= 3)) return 'drought.meltdown'
  if (stats.daysSinceOpen >= 6) return 'drought.dramatic'
  if (stats.daysSinceOpen >= 3) return 'drought.smug'
  return null
}
