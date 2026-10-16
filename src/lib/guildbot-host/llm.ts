import 'server-only'
import type { LlmClient } from '@guildboard/guildbot'
import { aiJson } from '@/lib/ai'

/** GuildBot's model, through the app's one AI wrapper (Gemini first, OpenAI last). Null on any failure. */
export const llm: LlmClient = {
  json: args => aiJson(args),
}
