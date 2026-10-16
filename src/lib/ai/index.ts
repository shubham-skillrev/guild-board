import 'server-only'
import { GEMINI_FALLBACK_MODEL, GEMINI_MODELS, geminiJsonOnce, isGeminiConfigured } from './gemini'
import { isOpenAiConfigured, OPENAI_MODEL, openaiJsonOnce } from './openai'
import { AiCallError, type AiJsonArgs } from './types'

export type { AiJsonArgs } from './types'

/**
 * The one place GuildBoard asks an AI model for anything.
 *
 * Used for curating and summarising Bytes, suggesting the month's topics and
 * themes, drafting announcements, and everything GuildBot says. Each asks for
 * JSON against a schema, on material we fetched ourselves: the model never
 * searches the web and never supplies a link; callers only accept ids that
 * point back at items they sent.
 *
 * Tries, in order, moving on whenever one is rate limited, overloaded, slow
 * or returns nothing usable:
 *
 *   1. the tier's Gemini model (free)
 *   2. gemini-3.5-flash (free, a separate allowance)
 *   3. OpenAI gpt-5.4-nano (paid, capped per day)
 *
 * A provider without a key is skipped. Every caller has a path that works
 * without any model, so null degrades the feature rather than breaking it.
 */
export async function aiJson<T>(args: AiJsonArgs): Promise<T | null> {
  const tier = args.tier ?? 'quality'
  const timeoutMs = args.timeoutMs ?? (tier === 'bulk' ? 90_000 : 40_000)

  const attempts: { provider: 'gemini' | 'openai'; model: string; run: () => Promise<T> }[] = []
  if (isGeminiConfigured()) {
    for (const model of new Set([GEMINI_MODELS[tier], GEMINI_FALLBACK_MODEL])) {
      attempts.push({ provider: 'gemini', model, run: () => geminiJsonOnce<T>(model, args, timeoutMs) })
    }
  }
  if (isOpenAiConfigured()) {
    attempts.push({ provider: 'openai', model: OPENAI_MODEL, run: () => openaiJsonOnce<T>(args, timeoutMs) })
  }
  if (!attempts.length) {
    console.warn(`${args.label}: no AI key is set, skipping`)
    return null
  }

  let skipGemini = false
  for (const [i, attempt] of attempts.entries()) {
    if (skipGemini && attempt.provider === 'gemini') continue
    const started = Date.now()
    try {
      const result = await attempt.run()
      if (i > 0) console.info(`${args.label}: answered by ${attempt.model} after ${i} failed attempt(s)`)
      return result
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err)
      console.warn(`${args.label}: ${attempt.model} failed after ${Date.now() - started}ms (${reason})`)
      // A bad request or key fails the same way on every Gemini model, but
      // OpenAI is a different API: it still gets its turn.
      if (err instanceof AiCallError && !err.transient && attempt.provider === 'gemini') skipGemini = true
    }
  }
  return null
}

/** Whether any provider has a key: features that need a model check this. */
export function isAiConfigured(): boolean {
  return isGeminiConfigured() || isOpenAiConfigured()
}
