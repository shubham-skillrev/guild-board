import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { AiCallError, type AiJsonArgs } from './types'

/**
 * OpenAI: the last resort, when both Gemini models are out of quota or down.
 * Paid, so it is the cheapest model that still writes well, without
 * reasoning tokens, and capped per day (OPENAI_DAILY_CAP, default 200 calls).
 *
 * gpt-5.4-nano was picked in October 2026 against gpt-5-nano on the
 * announcement prompt: about 230 tokens and 3s a draft, and it kept the
 * "no em dashes" rule that gpt-5-nano broke.
 *
 * OPENAI_API_KEY unset means this provider is skipped.
 */
export const OPENAI_MODEL = 'gpt-5.4-nano'
const DEFAULT_DAILY_CAP = 200

export function isOpenAiConfigured(): boolean {
  return !!process.env.OPENAI_API_KEY
}

/**
 * One call. Throws AiCallError on failure or when today's cap is spent.
 * The cap is counted in the database (migration 033), so it holds across
 * serverless instances; without that migration OpenAI is never called.
 */
export async function openaiJsonOnce<T>(args: AiJsonArgs, timeoutMs: number): Promise<T> {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) throw new AiCallError('OPENAI_API_KEY is not set', false)

  const cap = Number(process.env.OPENAI_DAILY_CAP) || DEFAULT_DAILY_CAP
  const { data: allowed, error } = await createAdminClient().rpc('ai_usage_take', { p_provider: 'openai', p_cap: cap })
  if (error) throw new AiCallError(`usage counter unavailable (is migration 033 applied?): ${error.message}`, false)
  if (!allowed) throw new AiCallError(`daily cap of ${cap} calls reached`, false)

  let res: Response
  try {
    res = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(timeoutMs),
      body: JSON.stringify({
        model: OPENAI_MODEL,
        instructions: args.system,
        input: args.prompt,
        reasoning: { effort: 'none' },
        max_output_tokens: args.tier === 'bulk' ? 16_000 : 4_000,
        store: false,
        text: {
          format: {
            type: 'json_schema',
            name: args.label.replace(/[^a-zA-Z0-9_-]+/g, '_').slice(0, 64) || 'result',
            strict: true,
            schema: strictSchema(args.schema),
          },
        },
      }),
    })
  } catch (err) {
    throw new AiCallError(err instanceof Error ? err.message : String(err), true)
  }

  const data = await res.json().catch(() => null) as OpenAiResponse | null
  if (!res.ok) {
    throw new AiCallError(`${res.status}: ${(data?.error?.message ?? '').slice(0, 200)}`, res.status === 429 || res.status >= 500)
  }
  if (data?.status !== 'completed') throw new AiCallError(`response ${data?.status ?? 'missing'}`, true)
  const text = data.output?.flatMap(o => o.content ?? []).find(c => c.type === 'output_text')?.text?.trim()
  if (!text) throw new AiCallError('no output text (refused?)', true)
  try {
    return JSON.parse(text) as T
  } catch {
    throw new AiCallError('unparsable JSON', true)
  }
}

interface OpenAiResponse {
  status?: string
  error?: { message?: string }
  output?: { content?: { type: string; text?: string }[] }[]
}

/**
 * Our schemas, as OpenAI's strict mode wants them: every object closed
 * (additionalProperties false) and every property listed as required. A field
 * a caller treats as optional just always comes back; callers already
 * validate what they read.
 */
function strictSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(strictSchema)
  if (!node || typeof node !== 'object') return node
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(node)) out[k] = k === 'enum' ? v : strictSchema(v)
  if (out.type === 'object' && out.properties && typeof out.properties === 'object') {
    out.additionalProperties = false
    out.required = Object.keys(out.properties)
  }
  return out
}
