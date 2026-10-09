/**
 * The board's format: how participation works, the same every month.
 *
 * Problem Month (Oct 2026) introduced it: uncapped "me too" and "I can help"
 * reactions, no rank or quota strip, the leaders rail off. It
 * stuck, so it now applies to every month. What a month is *about* is its
 * theme, stored per cycle (src/lib/themes, migration 026), and themes change
 * copy only, never these mechanics.
 *
 * Flipping this off restores the old capped, ranked board in the UI. It
 * cannot undo migration 023, which dropped the vote and contribution caps in
 * the database; that file's header has the statements that put them back.
 */
export const FOCUS_FORMAT = true

/**
 * Bytes stays on. It was hidden at first on the argument that it competes
 * with sharing a problem; it is kept because it is the one reason to open
 * GuildBoard between sessions. Separate from FOCUS_FORMAT so either can change
 * without the other.
 */
export const HIDE_BYTES = false

/**
 * A card shows a line or two of the description as plain text, where markdown
 * would read as literal `##` and asterisks. The form folds "What have you
 * tried" into the description as bold-labelled sections; those labels become
 * inline prefixes. Everything else is stripped down to its text.
 */
export function problemBlurb(description: string): string {
  return description
    .replace(/\*\*(.+?)\*\*\s*\n/g, '$1: ')
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/^\s{0,3}(#{1,6}|>+|[-*+]|\d+[.)])\s+/gm, '')
    .replace(/^\s*([-*_]\s*){3,}$/gm, '')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/(^|[^\w*])[*_]([^*_\n]+)[*_](?=[^\w*]|$)/g, '$1$2')
    .replace(/~~(.+?)~~/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}
