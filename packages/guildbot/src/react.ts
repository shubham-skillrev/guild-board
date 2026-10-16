import type { Mood } from './types.ts'
import type { LineKey } from './lines.ts'

/**
 * GuildBot reacting to the board as it happens: the live layer on top of its
 * mood. The mood (moodFor) is the month so far; a reaction is the next few
 * seconds, a face and sometimes a line, then back to the mood.
 *
 *   relieved  a human posted while the board was empty or slow
 *   excited   a burst of activity, a crowd arriving, any other new post
 *   nosy      comments and poll votes: something is being argued
 *   lonely    you're the only one on the board
 *   sleepy    the same, late at night
 *
 * GuildBoard is his home, so a visitor is an event: when you arrive he
 * perks up, and if the board has been quiet it's plain relief.
 *
 * Pure, so the rules are tested: in particular a ghost post gets exactly the
 * reaction anyone else's post gets, so the poster's own screen never tells
 * on them.
 */
export type Reaction = 'relieved' | 'excited' | 'nosy' | 'lonely' | 'sleepy'

/** Every face GuildBot can pull: its mood, or a reaction for a few seconds. */
export type Expression = Mood | Reaction

export type BoardEvent =
  /** `mine`: this viewer posted it, under their name or as a ghost. Null: someone else did. */
  | { kind: 'post'; mine: 'named' | 'ghost' | null; humanPostsBefore: number }
  | { kind: 'vote' }
  | { kind: 'comment' }
  | { kind: 'poll' }
  /** The viewer just arrived on the board. */
  | { kind: 'arrive' }
  /** Tabs on the board (presence carries no identity), before and after. */
  | { kind: 'presence'; present: number; before: number }

export interface ReactContext {
  /** The mood before this event. */
  mood: Mood
  /** Other board events in the last minute, this one not counted. */
  recent: number
  /** The viewer's local hour, 0 to 23. */
  hour: number
}

export interface Reacting {
  expression: Reaction
  /** A line worth a speech bubble, or null for a face only. The host rate-limits bubbles. */
  line: LineKey | null
}

/** A minute with this many events, counting the new one, is a burst. */
export const BURST = 3

const lateNight = (hour: number) => hour >= 23 || hour < 5

/** The reaction to one event, or null when it is not worth a face. */
export function reactTo(event: BoardEvent, ctx: ReactContext): Reacting | null {
  const burst = ctx.recent + 1 >= BURST
  switch (event.kind) {
    case 'post': {
      // Only a post under your own name gets a line about you. A ghost post is
      // handled exactly like a stranger's: same face, same line.
      if (event.mine === 'named') return { expression: 'excited', line: 'react.posted.you' }
      const drought = event.humanPostsBefore === 0 || ctx.mood === 'bored' || ctx.mood === 'dramatic'
      return drought
        ? { expression: 'relieved', line: 'react.relieved' }
        : { expression: 'excited', line: 'react.posted.crowd' }
    }
    case 'vote':
      return burst ? { expression: 'excited', line: 'react.excited' } : { expression: 'excited', line: null }
    case 'comment':
    case 'poll':
      return burst ? { expression: 'excited', line: 'react.excited' } : { expression: 'nosy', line: event.kind === 'comment' ? 'react.nosy' : null }
    case 'arrive':
      return ctx.mood === 'bored' || ctx.mood === 'dramatic'
        ? { expression: 'relieved', line: 'react.arrive.starved' }
        : { expression: 'excited', line: lateNight(ctx.hour) ? 'react.sleepy' : 'react.arrive' }
    case 'presence': {
      // Someone else turned up: a face, and a line only for a crowd.
      if (event.present > event.before && event.before >= 1 && event.present < 3) return { expression: 'excited', line: null }
      if (event.present >= 3 && event.before < 3) return { expression: 'excited', line: 'react.crowd' }
      if (event.present === 1 && event.before !== 1) {
        return lateNight(ctx.hour) ? { expression: 'sleepy', line: 'react.sleepy' } : { expression: 'lonely', line: 'react.lonely' }
      }
      return null
    }
  }
}
