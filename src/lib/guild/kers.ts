import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { aiJson } from '@/lib/ai'

/**
 * Kers reads the numbers to the organisers.
 *
 * Code works out every number and every action first; Kers only narrates
 * them. The model gets those facts and nothing else, and a briefing that
 * mentions any number not in them is thrown away for the written fallback.
 * A dashboard that is funny and wrong once is never trusted again.
 *
 * Briefings are cached per scope per day (migration 040): the daily cron
 * writes one, and an organiser can ask again a few times a day. Pages never
 * wait on the model; they show the cache, or the fallback line.
 */

export type Facts = Record<string, number | string | boolean | null>

export interface Briefing {
  body: string
  byAi: boolean
  refreshesLeft: number
}

export const REFRESHES_PER_DAY = 3
const MAX_CHARS = 420

function today(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

function keyOf(scope: string): string {
  return `${scope}:${today()}`
}

/** Today's briefing for a scope, or the fallback line. Never calls the model. */
export async function readBriefing(scope: string, fallback: string): Promise<Briefing> {
  const { data } = await createAdminClient()
    .from('kers_briefings')
    .select('body, by_ai, refreshes')
    .eq('key', keyOf(scope))
    .maybeSingle()
  if (!data) return { body: fallback, byAi: false, refreshesLeft: REFRESHES_PER_DAY }
  return { body: data.body, byAi: data.by_ai, refreshesLeft: Math.max(0, REFRESHES_PER_DAY - data.refreshes) }
}

const SYSTEM = [
  'You are Kers, the mascot of GuildBoard, the SkillRev engineering guild\'s board:',
  'a round mint blob who narrates the guild like a dramatic, sarcastic, mischievous',
  'commentator. You are briefing the guild organisers on their dashboard.',
  '',
  'Write 2 or 3 short sentences, under 380 characters in total, in English.',
  'Be witty, but every briefing ends on the single most useful thing to do next,',
  'taken from the actions list.',
  '',
  'Rules you never break:',
  '- Use only the numbers in the facts and actions. Never compute, round or invent one.',
  '- Never name or describe any individual person.',
  '- Tease the numbers, the board or yourself, never a person or a team.',
  '- No emoji, no hashtags, no links.',
].join('\n')

function numbersIn(text: string): string[] {
  return text.match(/\d+(?:\.\d+)?/g) ?? []
}

/**
 * Ask Kers for a fresh briefing and cache it. `manual` counts against the
 * day's refreshes. Falls back to the written line when the model is out,
 * slow, or strays from the facts.
 */
export async function refreshBriefing(
  scope: string,
  facts: Facts,
  actions: string[],
  fallback: string,
  manual = false,
): Promise<Briefing> {
  const admin = createAdminClient()
  const key = keyOf(scope)
  const { data: existing } = await admin.from('kers_briefings').select('refreshes').eq('key', key).maybeSingle()
  const used = existing?.refreshes ?? 0
  if (manual && used >= REFRESHES_PER_DAY) return readBriefing(scope, fallback)

  const result = await aiJson<{ briefing?: unknown }>({
    label: `kers: ${scope} briefing`,
    tier: 'bulk',
    system: SYSTEM,
    prompt: `Facts:\n${JSON.stringify(facts, null, 2)}\n\nActions, most useful first:\n${actions.map((a, i) => `${i + 1}. ${a}`).join('\n') || '(none)'}`,
    schema: {
      type: 'object',
      properties: { briefing: { type: 'string', description: 'Two or three sentences, under 380 characters.' } },
      required: ['briefing'],
    },
  }).catch(() => null)

  const allowed = new Set(numbersIn(`${JSON.stringify(facts)} ${actions.join(' ')}`))
  let body = typeof result?.briefing === 'string' ? result.briefing.replace(/\s+/g, ' ').trim() : ''
  const strays = numbersIn(body).filter(n => !allowed.has(n))
  const byAi = !!body && body.length <= MAX_CHARS && strays.length === 0 && !/https?:\/\//.test(body)
  if (!byAi) body = fallback

  await admin.from('kers_briefings').upsert({
    key,
    body: body.slice(0, 1200),
    by_ai: byAi,
    refreshes: used + (manual ? 1 : 0),
    created_at: new Date().toISOString(),
  })
  return { body, byAi, refreshesLeft: Math.max(0, REFRESHES_PER_DAY - used - (manual ? 1 : 0)) }
}
