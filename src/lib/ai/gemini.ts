import 'server-only'
import { GoogleGenAI } from '@google/genai'
import { AiCallError, type AiJsonArgs } from './types'

/**
 * Google Gemini, through the Interactions API: the first choice for every
 * model call. Callers go through aiJson (src/lib/ai/index.ts), which falls
 * back to another Gemini model and then to OpenAI.
 *
 * GEMINI_API_KEY unset means this provider is skipped.
 */

/* Two tiers. Judgement-heavy work (picking the month's topics, announcements)
   gets the best Flash model; bulk mechanical work (scoring and summarising
   dozens of items) gets Flash-Lite, which has far more free-tier headroom.
   Free-tier limits are per model, so the fallback is another allowance. */
export const GEMINI_MODELS = {
  quality: 'gemini-3.8-flash',
  bulk: 'gemini-3.5-flash-lite',
} as const
export const GEMINI_FALLBACK_MODEL = 'gemini-3.5-flash'

export function isGeminiConfigured(): boolean {
  return !!process.env.GEMINI_API_KEY
}

let cached: GoogleGenAI | null = null
function client(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null
  cached ??= new GoogleGenAI({ apiKey })
  return cached
}

/**
 * One attempt on one model. Throws AiCallError on failure (transient when
 * another model might do better), never logs the key.
 *
 * The SDK's own retries are off: it otherwise retries a 429 four times with
 * backoff (about 36s) before we see it, and a daily quota will not reset in
 * that time. Moving to the next model is the retry.
 */
export async function geminiJsonOnce<T>(model: string, args: AiJsonArgs, timeoutMs: number): Promise<T> {
  const ai = client()
  if (!ai) throw new AiCallError('GEMINI_API_KEY is not set', false)
  let text: string | undefined
  try {
    const interaction = await ai.interactions.create(
      {
        model,
        system_instruction: args.system,
        input: args.prompt,
        response_format: { type: 'text', mime_type: 'application/json', schema: args.schema },
      },
      { maxRetries: 0, timeout: timeoutMs },
    )
    text = interaction.output_text?.trim()
  } catch (err) {
    const status = (err as { status?: number }).status
    const message = err instanceof Error ? err.message : String(err)
    // Rate limits, overload and timeouts are worth another model; a bad
    // request or a bad key is not.
    const transient = status === undefined || status === 408 || status === 429 || status >= 500
    throw new AiCallError(`${status ?? 'error'}: ${message.slice(0, 200)}`, transient)
  }
  if (!text) throw new AiCallError('empty response', true)
  try {
    return JSON.parse(text) as T
  } catch {
    throw new AiCallError('unparsable JSON', true)
  }
}
