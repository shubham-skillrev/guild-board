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
export { activityAt, meetingOn, meetingJustEnded, MEETING_MINUTES, type Activity } from './schedule.ts'
export { dressFor, seasonOf, describeWeather, type Season, type WeatherLook, type WeatherFacts, type Wear } from './weather.ts'
export { reactTo, BURST, type Reaction, type Expression, type BoardEvent, type ReactContext, type Reacting } from './react.ts'
export { PERSONA, CHARACTER, LANGUAGE, STYLE, HARD_RULES, REVIEW_CHECKS, MEMES, EXAMPLES, REPLY_EXAMPLES } from './persona.ts'
export { writeComment, writeReply, BIT_CHANCE } from './comments.ts'
export { chat, CHAT_RULES, CHAT_FALLBACK, type ChatContext, type ChatTopic, type ChatByte, type ChatTurn, type ChatDraft, type ChatAnswer } from './chat.ts'
export { summariseLearnings, type AskedQuestion, type Learnings } from './learnings.ts'
export { welcomeKey, meetingWhen, isoWeek, type WelcomeFacts } from './welcome.ts'
