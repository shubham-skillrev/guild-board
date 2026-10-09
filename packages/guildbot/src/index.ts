/**
 * @guildboard/guildbot
 *
 * The bot's brain, kept apart from the app on purpose: no database, no HTTP,
 * no app imports. The host passes in sanitized views and an LLM client, so the
 * bot cannot reach anything it should not say.
 */
export * from './types.ts'
export { guard, tidy, type GuardContext, type GuardResult } from './guard.ts'
export { LINES, line, type LineKey } from './lines.ts'
export { moodFor, droughtTier, type DroughtTier } from './mood.ts'
export { PERSONA, EXAMPLES, REPLY_EXAMPLES } from './persona.ts'
