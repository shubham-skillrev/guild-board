import 'server-only'
import type { LlmClient } from '@guildboard/guildbot'
import { geminiJson } from '@/lib/ai/gemini'

/** GuildBot's model, through the app's one Gemini wrapper. Null on any failure. */
export const llm: LlmClient = {
  json: args => geminiJson(args),
}
