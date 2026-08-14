import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import type { Candidate } from '@/lib/bytes/sources'

/**
 * Summarize fetched feed items.
 *
 * ── The integrity contract ──────────────────────────────────────────────
 * The model is asked for exactly two things per item: `summary` and `tags`.
 * The response schema has `additionalProperties: false` and lists no title or
 * url field, so a structured-outputs response *cannot* contain a headline —
 * the model has nowhere to put one. The caller writes `source_title` and `url`
 * verbatim from the feed response and ignores everything else.
 *
 * Items whose `source_id` was not in the input are dropped, so the model also
 * cannot invent an entry. This is enforcement, not prompt etiquette: a
 * fabricated headline in an engineer-facing digest destroys its credibility
 * permanently, and "please don't make things up" is not a control.
 *
 * The API key is optional by design. Without it the digest is still created
 * with empty summaries for the admin to fill in by hand — a monthly ritual
 * must not hard-depend on a third-party API being reachable.
 */

const MODEL = 'claude-opus-5'
const SUMMARY_MAX = 400

export interface Summary {
  source_id: string
  summary: string
  tags: string[]
}

/** Mirrors the CHECK constraints in migration 014. */
const RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      description: 'One entry per input item, in any order.',
      items: {
        type: 'object',
        properties: {
          source_id: {
            type: 'string',
            description: 'Echo the source_id of the item being summarized, exactly as given.',
          },
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
        additionalProperties: false,
      },
    },
  },
  required: ['items'],
  additionalProperties: false,
} as const

const SYSTEM = [
  'You summarize tech news items for a small engineering guild that meets monthly.',
  '',
  'You are given items that were already fetched from real feeds. For each one,',
  'write a short, factual summary and a few topic tags.',
  '',
  'Ground every summary in the title and excerpt you are given. If an excerpt is',
  'missing or thin, say less — describe only what the title supports. Never invent',
  'version numbers, benchmarks, dates, company names, or outcomes that are not',
  'present in the input.',
  '',
  'Write for engineers: plain, specific, and skimmable. No hype, no "game-changing",',
  'no restating the headline back.',
].join('\n')

/**
 * Returns a map of source_id -> summary. Entries are missing rather than
 * fabricated when the model omits an item or the key is absent.
 */
export async function summarizeCandidates(
  candidates: Candidate[],
): Promise<Map<string, Summary>> {
  const out = new Map<string, Summary>()
  if (!candidates.length) return out

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.warn('bytes: ANTHROPIC_API_KEY not set — creating digest without summaries')
    return out
  }

  const client = new Anthropic({ apiKey })

  // Only the fields the model needs. Note the model is never shown the URL —
  // it has no reason to reproduce one, and cannot leak one into a summary.
  const payload = candidates.map(c => ({
    source_id: c.source_id,
    title: c.title,
    points: c.points,
    excerpt: c.excerpt ?? null,
  }))

  const validIds = new Set(candidates.map(c => c.source_id))

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: SYSTEM,
      // Cheap, mechanical task — the quality lever here is grounding, not depth.
      output_config: {
        effort: 'low',
        format: { type: 'json_schema', schema: RESPONSE_SCHEMA },
      },
      messages: [
        {
          role: 'user',
          content:
            `Summarize each of these ${payload.length} items.\n\n` +
            JSON.stringify(payload, null, 2),
        },
      ],
    })

    // Safety classifiers can decline a request; content is empty or partial.
    if (response.stop_reason === 'refusal') {
      console.warn('bytes: summarization refused', response.stop_details)
      return out
    }
    if (response.stop_reason === 'max_tokens') {
      console.warn('bytes: summarization hit max_tokens — output may be partial')
    }

    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('')

    if (!text.trim()) return out

    const parsed = JSON.parse(text) as { items?: unknown }
    if (!Array.isArray(parsed.items)) return out

    for (const raw of parsed.items) {
      if (!raw || typeof raw !== 'object') continue
      const item = raw as Partial<Summary>

      // Drop anything the model invented — a source_id we never sent.
      if (typeof item.source_id !== 'string' || !validIds.has(item.source_id)) {
        console.warn('bytes: dropping unknown source_id from model output', item.source_id)
        continue
      }
      if (typeof item.summary !== 'string' || !item.summary.trim()) continue

      out.set(item.source_id, {
        source_id: item.source_id,
        // Enforce the length cap server-side as well as in the prompt, so a
        // long summary can never trip the DB CHECK constraint.
        summary: item.summary.trim().slice(0, SUMMARY_MAX),
        tags: Array.isArray(item.tags)
          ? item.tags.filter((t): t is string => typeof t === 'string').slice(0, 3)
          : [],
      })
    }
  } catch (err) {
    // A failed summarization degrades to a hand-written digest, never a failed run.
    console.warn('bytes: summarization failed', err)
  }

  return out
}
