import 'server-only'
import { GoogleGenAI } from '@google/genai'

/**
 * The one place GuildBoard talks to an AI model: Google Gemini, through the
 * Interactions API.
 *
 * Used for three jobs, all on material we fetched ourselves (engineering
 * feeds, Google News search, Hacker News): curating the Bytes pool, writing
 * its summaries, and suggesting the month's board topics. Each asks for JSON
 * against a schema. The model never searches the web itself (grounding needs
 * a billed project), and never supplies a headline or a link: callers only
 * accept ids that point back at items they sent.
 *
 * GEMINI_API_KEY unset means off. Every caller has a path that works without
 * it, so a missing key degrades the feature rather than breaking a cron.
 */

/* Two tiers. Judgement-heavy work (picking the month's topics) gets the best
   Flash model; bulk mechanical work (scoring and summarising dozens of items)
   gets Flash-Lite, which is fast and has far more free-tier headroom. Each
   falls back to gemini-3.5-flash when overloaded (503) or out of quota (429):
   free-tier limits are per model, so another model is another allowance. */
const MODELS = {
  quality: 'gemini-3.8-flash',
  bulk: 'gemini-3.5-flash-lite',
} as const
const FALLBACK_MODEL = 'gemini-3.5-flash'
/** Longest suggested wait worth honouring before moving to the fallback. */
const MAX_WAIT_MS = 45_000

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
 * Ask for JSON matching `schema`.
 * Returns null on any failure (no key, API error, unparsable output) and logs
 * why, never the key.
 */
export async function geminiJson<T>(args: {
  system: string
  prompt: string
  schema: Record<string, unknown>
  label: string
  /** 'quality' for judgement, 'bulk' for many small mechanical items. */
  tier?: keyof typeof MODELS
}): Promise<T | null> {
  const ai = client()
  if (!ai) {
    console.warn(`${args.label}: GEMINI_API_KEY is not set, skipping`)
    return null
  }
  // One retry on the primary when Google names a short wait, then the
  // fallback model once. Anything else fails fast.
  const primary = MODELS[args.tier ?? 'quality']
  const attempts: string[] = [primary, primary, FALLBACK_MODEL]
  for (let i = 0; i < attempts.length; i++) {
    const model = attempts[i]
    try {
      const interaction = await ai.interactions.create({
        model,
        system_instruction: args.system,
        input: args.prompt,
        response_format: { type: 'text', mime_type: 'application/json', schema: args.schema },
      })
      const text = interaction.output_text?.trim()
      if (!text) {
        console.warn(`${args.label}: empty response from ${model}`)
        return null
      }
      return JSON.parse(text) as T
    } catch (err) {
      const status = (err as { status?: number }).status
      const message = err instanceof Error ? err.message : String(err)
      const transient = status === 429 || status === 503
      console.warn(`${args.label}: ${model} failed (${status ?? 'error'})`, message.slice(0, 200))
      if (!transient || i === attempts.length - 1) return null

      if (attempts[i + 1] === model) {
        // A daily quota will not reset in seconds: go straight to the fallback.
        if (/per day/i.test(message)) { i++; continue }
        // Same model again: only if Google suggested a wait we can afford.
        const waitS = Number(message.match(/retry in (\d+(?:\.\d+)?)s/i)?.[1] ?? (status === 503 ? 5 : NaN))
        if (!Number.isFinite(waitS) || waitS * 1000 > MAX_WAIT_MS) { i++; continue }
        await new Promise(res => setTimeout(res, waitS * 1000 + 500))
      }
    }
  }
  return null
}
