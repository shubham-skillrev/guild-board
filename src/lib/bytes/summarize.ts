import 'server-only'
import { geminiJson } from '@/lib/ai/gemini'
import type { Candidate } from '@/lib/bytes/sources'

/**
 * Gemini's two jobs on the Bytes pool: curate it, then summarise the picks.
 *
 * ── The integrity contract ──────────────────────────────────────────────
 * The model never supplies a headline or a link. Its response schemas have no
 * title or url field, so a structured response *cannot* contain one; the
 * caller writes `source_title` and `url` verbatim from the feed and ignores
 * everything else. The model is not even shown the URL.
 *
 * Items whose `source_id` was not in the input are dropped, so the model also
 * cannot invent an entry. This is enforcement, not prompt etiquette: a
 * fabricated headline in an engineer-facing digest destroys its credibility
 * permanently, and "please don't make things up" is not a control.
 *
 * GEMINI_API_KEY is optional by design. Without it the pool is not curated
 * (feed ranking alone decides) and the digest publishes with empty summaries
 * for the admin to fill in. A monthly ritual must not hard-depend on a
 * third-party API being reachable.
 */

const SUMMARY_MAX = 400

export interface Summary {
  source_id: string
  summary: string
  tags: string[]
}

/** Only the fields the model needs. Never the URL. */
function payloadOf(candidates: Candidate[]) {
  return candidates.map(c => ({
    source_id: c.source_id,
    title: c.title,
    publisher: c.source_name,
    medium: c.source === 'video' ? 'video' : c.source === 'news' ? 'news' : 'article',
    excerpt: c.excerpt?.slice(0, 300) ?? null,
  }))
}

/* ─── Curate ──────────────────────────────────────────────── */

const CURATE_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          source_id: { type: 'string', description: 'Exactly as given.' },
          relevance: {
            type: 'number',
            description: '0 to 1: how worth an hour of a senior engineering guild this is.',
          },
        },
        required: ['source_id', 'relevance'],
      },
    },
  },
  required: ['items'],
}

const CURATE_SYSTEM = [
  'You curate a reading list for an engineering guild of about thirty software engineers.',
  'Score every item from 0 to 1 for how worth their time it is.',
  '',
  'High (0.7-1): substantive engineering or AI content: how something was built, a',
  'notable release, a real incident or postmortem, research with practical impact.',
  'Middle (0.4-0.7): relevant news with some technical depth.',
  'Low (0-0.3): funding rounds, earnings, gadget and consumer news, career fluff,',
  'listicles, press releases, clickbait, local news that mentions tech in passing.',
  '',
  'Judge only from the title, publisher and excerpt given. Score every item.',
].join('\n')

/**
 * Relevance per candidate, 0 to 1. Missing entries mean "not judged" (no key,
 * or the model skipped it); callers keep those at their feed score.
 */
export async function curateCandidates(candidates: Candidate[]): Promise<Map<string, number>> {
  const out = new Map<string, number>()
  if (!candidates.length) return out
  const valid = new Set(candidates.map(c => c.source_id))

  const result = await geminiJson<{ items?: { source_id?: unknown; relevance?: unknown }[] }>({
    label: 'bytes: curation',
    tier: 'bulk',
    system: CURATE_SYSTEM,
    prompt: `Score each of these ${candidates.length} items.\n\n${JSON.stringify(payloadOf(candidates))}`,
    schema: CURATE_SCHEMA,
  })
  for (const item of result?.items ?? []) {
    if (typeof item.source_id !== 'string' || !valid.has(item.source_id)) continue
    const r = Number(item.relevance)
    if (Number.isFinite(r)) out.set(item.source_id, Math.min(1, Math.max(0, r)))
  }
  return out
}

/* ─── Summarise ──────────────────────────────────────────── */

const SUMMARY_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      description: 'One entry per input item, in any order.',
      items: {
        type: 'object',
        properties: {
          source_id: { type: 'string', description: 'Echo the source_id exactly as given.' },
          summary: {
            type: 'string',
            description:
              `Two or three plain sentences on what this is and why an engineer might care. ` +
              `Under ${SUMMARY_MAX} characters. No marketing language, no hype, no restating the title.`,
          },
          tags: {
            type: 'array',
            description: '1-3 lowercase topic tags, e.g. ["rust", "performance"].',
            items: { type: 'string' },
          },
        },
        required: ['source_id', 'summary', 'tags'],
      },
    },
  },
  required: ['items'],
}

const SUMMARY_SYSTEM = [
  'You summarize tech items for a small engineering guild that meets monthly.',
  '',
  'You are given items that were already fetched from real feeds. For each one,',
  'write a short, factual summary and a few topic tags.',
  '',
  'Each item carries a `medium`: article (an engineering blog post), news (tech',
  'reporting) or video (a talk or explainer). Match it: a video is something to',
  'watch, not to read, so never describe a video as an article.',
  '',
  'Ground every summary in the title and excerpt you are given. If an excerpt is',
  'missing or thin, say less and describe only what the title supports. Never',
  'invent version numbers, benchmarks, dates, company names, or outcomes that are',
  'not present in the input.',
  '',
  'Write for engineers: plain, specific, and skimmable. No hype, no "game-changing",',
  'no restating the headline back.',
].join('\n')

/**
 * Returns a map of source_id -> summary. Entries are missing rather than
 * fabricated when the model omits an item or the key is absent.
 */
export async function summarizeCandidates(candidates: Candidate[]): Promise<Map<string, Summary>> {
  const out = new Map<string, Summary>()
  if (!candidates.length) return out
  const valid = new Set(candidates.map(c => c.source_id))

  const result = await geminiJson<{ items?: Partial<Summary>[] }>({
    label: 'bytes: summaries',
    tier: 'bulk',
    system: SUMMARY_SYSTEM,
    prompt: `Summarize each of these ${candidates.length} items.\n\n${JSON.stringify(payloadOf(candidates), null, 2)}`,
    schema: SUMMARY_SCHEMA,
  })

  for (const item of result?.items ?? []) {
    // Drop anything the model invented: a source_id we never sent.
    if (typeof item.source_id !== 'string' || !valid.has(item.source_id)) continue
    if (typeof item.summary !== 'string' || !item.summary.trim()) continue
    out.set(item.source_id, {
      source_id: item.source_id,
      // Enforce the cap here as well as in the prompt, so a long summary can
      // never trip the DB CHECK constraint.
      summary: item.summary.trim().slice(0, SUMMARY_MAX),
      tags: Array.isArray(item.tags)
        ? item.tags.filter((t): t is string => typeof t === 'string').map(t => t.toLowerCase()).slice(0, 3)
        : [],
    })
  }
  return out
}
