import type { Surface } from './types.ts'

/**
 * The last check before anything the bot wrote is shown to a person.
 *
 * Deterministic rules only. It fails closed: when in doubt the line is
 * rejected and the bot says nothing, which is always an acceptable outcome.
 * A model-based tone check can run after this one, never instead of it.
 */

export interface GuardContext {
  surface: Surface
  /** Usernames the bot may @-mention here: roast-me users, in the app only. */
  allowedMentions?: string[]
  /** Override the per-surface length cap. */
  maxLength?: number
}

export type GuardResult = { ok: true; text: string } | { ok: false; reasons: string[] }

const MAX_LENGTH: Record<Surface, number> = {
  comment: 280,
  reply: 280,
  slack: 600,
  push: 160,
  ui: 160,
  chat: 1200,
}

/** Never joke about these, whoever asks. Matches fail the line. */
const NO_GO: { reason: string; pattern: RegExp }[] = [
  // Narrow on purpose: "the webhook fired" and "bonus points" are fine here.
  { reason: 'jobs and careers', pattern: /\b(lay ?offs?|laid off|(got|get|getting|be|been) fired|appraisals?|performance reviews?|promotions?|salar(y|ies)|pay ?(cut|rise|raise)s?|bonus (cut|season|payout)s?|resign(ed|ing|ation)?)\b/i },
  { reason: 'jobs and careers', pattern: /\b(HR|PIP)\b/ },
  { reason: 'managers', pattern: /\b(your|their|my|our|the) (manager|boss|lead)s?\b|\bmanagers\b/i },
  { reason: 'singling out who did not take part', pattern: /\b(you|@\w+|they|he|she)\s+(haven'?t|have not|never|didn'?t|did not)\s+(posted|voted|commented|shown up|replied|said anything)/i },
  { reason: 'guessing who is behind a ghost', pattern: /\b(who (really )?(wrote|posted) (this|it)|i bet (it'?s|this is|that'?s)|probably (is|was) @|unmask|real name|we all know who)\b/i },
  { reason: 'breaking character', pattern: /\b(as an ai|language model|my (system )?prompt|my instructions|i was (told|instructed) to)\b/i },
  { reason: 'describing how it is built', pattern: /\b(i('m| am)|i was|i'm being) (powered|built|made|trained|run|hosted) (by|on|with)\b|\b(powered by|running on) (gemini|google|openai|gpt|claude|anthropic|vercel|supabase)\b/i },
]

const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/
const UUID = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i
const GHOST = /\bghost_[0-9a-f]{6}\b/i
const MENTION = /(^|[^\w@])@([a-z0-9_]{3,30})\b/gi

/**
 * House style: no em or en dashes in user-facing copy. Rewritten rather than
 * rejected, since a model reaches for them constantly.
 */
export function tidy(text: string): string {
  return text
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/,\s*,/g, ',')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

export function guard(raw: string, ctx: GuardContext): GuardResult {
  const text = tidy(raw)
  const reasons: string[] = []

  if (!text) reasons.push('empty')
  const max = ctx.maxLength ?? MAX_LENGTH[ctx.surface]
  if (text.length > max) reasons.push(`longer than ${max} characters`)

  for (const rule of NO_GO) if (rule.pattern.test(text)) reasons.push(rule.reason)

  if (EMAIL.test(text)) reasons.push('contains an email address')
  if (UUID.test(text)) reasons.push('contains an internal id')

  // Mentions: only names the host explicitly allowed, and never in Slack,
  // where the audience includes people who did not opt in to anything.
  const allowed = new Set((ctx.allowedMentions ?? []).map(n => n.toLowerCase()))
  const mentioned = [...text.matchAll(MENTION)].map(m => m[2].toLowerCase())
  const stray = mentioned.filter(n => ctx.surface === 'slack' || !allowed.has(n))
  if (stray.length) reasons.push(`mentions someone it may not: @${stray.join(', @')}`)

  // A ghost handle next to any @name reads as a guess at who it is.
  if (GHOST.test(text) && mentioned.length) reasons.push('pairs a ghost with a name')

  return reasons.length ? { ok: false, reasons } : { ok: true, text }
}
