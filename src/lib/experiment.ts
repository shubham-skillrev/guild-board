/**
 * Problem Month: a one-off guild format. Members bring one real tech problem
 * instead of a topic, and the meeting is built around the ones people relate
 * to most. The point is participation: more people posting, more people
 * speaking.
 *
 * Everything the experiment changes in the UI reads from here, so going back
 * to the usual format is flipping this flag. The one thing it cannot undo is
 * migration 023, which drops the per-cycle vote and contribution caps.
 */
export const PROBLEM_MONTH = true

/**
 * Bytes stays on for Problem Month. It was hidden at first on the argument
 * that it competes with sharing a problem; it is kept because it is the one
 * reason to open GuildBoard between sessions. Separate from PROBLEM_MONTH so
 * either can change without the other.
 */
export const HIDE_BYTES = false

/** The month's vocabulary on the board. Reaction wording is per kind and
    lives in src/lib/kinds.ts. */
export const PROBLEM_COPY = {
  share: 'Share a problem',
  noun: 'discussion',
  nounPlural: 'discussions',
  boardNav: 'Board',
  boardSubtitle: "This month's theme: bring a problem",
} as const

/**
 * The form folds "What have you tried" into the description as bold-labelled
 * sections. A card shows one line of it, where `**What I've tried**` would read
 * as literal asterisks, so the labels become inline prefixes instead.
 */
export function problemBlurb(description: string): string {
  return description.replace(/\*\*(.+?)\*\*\s*\n/g, '$1: ')
}
