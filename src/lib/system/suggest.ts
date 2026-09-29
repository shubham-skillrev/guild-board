import 'server-only'
import Anthropic from '@anthropic-ai/sdk'
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema'
import type { SystemTopicDraft } from '@/lib/system/topics'

/**
 * Ask Claude what the guild should talk about this month.
 *
 * Two calls, on purpose:
 *   1. Research, with the server-side web search tool: find notable software
 *      and AI releases from the last month that are not already on the board
 *      or in Bytes, and write them up with sources.
 *   2. Structure, with no tools: turn those notes into strict JSON.
 * Structured outputs cannot be combined with citations, and web search
 * answers carry citations, so they cannot share one request.
 *
 * Grounding: a suggestion survives only if every source URL it cites was
 * actually returned by the search in step 1. The model can choose and frame,
 * but not invent a link.
 */

const MODEL = 'claude-opus-5'
/** Server-side search loops pause after 10 iterations; resume at most this often. */
const MAX_CONTINUATIONS = 4

const KIND_VALUES = ['problem', 'learned', 'new_tech', 'take', 'show_tell'] as const

const SCHEMA = {
  type: 'object',
  properties: {
    topics: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: [...KIND_VALUES] },
          title: { type: 'string', description: 'At most 80 characters. Plain, specific, no clickbait.' },
          why: { type: 'string', description: '2-4 sentences: what it is, when it shipped, and the question the guild could discuss.' },
          sources: {
            type: 'array',
            items: {
              type: 'object',
              properties: { name: { type: 'string' }, url: { type: 'string' } },
              required: ['name', 'url'],
              additionalProperties: false,
            },
          },
        },
        required: ['kind', 'title', 'why', 'sources'],
        additionalProperties: false,
      },
    },
  },
  required: ['topics'],
  additionalProperties: false,
} as const

const SYSTEM = `You pick discussion topics for SkillRev's monthly engineering guild: about thirty software engineers who meet for an hour to talk tech. A good topic is something shipped or announced recently that working engineers would genuinely want to argue about or try, not marketing or consumer gadget news.

Rules:
- Only include things you have confirmed through search, with the date they shipped or were announced.
- Skip anything already covered by the lists the user gives you, including near-duplicates.
- Prefer primary sources (the vendor's own post, the repo, the paper) plus one reputable report.
- Frame each as a conversation starter: end with the question the room could discuss.
- Write plainly. No hype words, no exclamation marks, no em dashes.`

function client(): Anthropic | null {
  return process.env.ANTHROPIC_API_KEY ? new Anthropic() : null
}

/** Every URL the web search actually returned, across all turns. */
function searchedUrls(content: Anthropic.Beta.BetaContentBlock[]): Set<string> {
  const urls = new Set<string>()
  for (const block of content) {
    if (block.type === 'web_search_tool_result' && Array.isArray(block.content)) {
      for (const r of block.content) if (r.type === 'web_search_result') urls.add(r.url)
    }
  }
  return urls
}

export async function suggestSystemTopics(args: {
  monthLabel: string
  existingTitles: string[]
  byteTitles: string[]
  count?: number
}): Promise<SystemTopicDraft[]> {
  const anthropic = client()
  if (!anthropic) {
    console.warn('system topics: ANTHROPIC_API_KEY is not set, skipping generation')
    return []
  }
  const count = args.count ?? 3

  const ask = `It is ${args.monthLabel}. Find up to ${count} notable software engineering or AI releases or announcements from roughly the last 30 days that would make good guild discussions.

Already on the board (do not repeat):
${args.existingTitles.map(t => `- ${t}`).join('\n') || '- (nothing yet)'}

Already in this month's reading digest (do not repeat):
${args.byteTitles.map(t => `- ${t}`).join('\n') || '- (nothing yet)'}

For each pick, give: what it is, the date, why engineers would want to talk about it, the question for the room, and the source URLs you used.`

  // ─── 1. Research ───
  const messages: Anthropic.Beta.BetaMessageParam[] = [{ role: 'user', content: ask }]
  let research: Anthropic.Beta.BetaMessage | null = null
  const allContent: Anthropic.Beta.BetaContentBlock[] = []
  for (let i = 0; i <= MAX_CONTINUATIONS; i++) {
    research = await anthropic.beta.messages
      .stream({
        model: MODEL,
        max_tokens: 32000,
        system: SYSTEM,
        thinking: { type: 'adaptive' },
        output_config: { effort: 'high' },
        tools: [{ type: 'web_search_20260209', name: 'web_search', max_uses: 10 }],
        betas: ['server-side-fallback-2026-07-01'],
        // Opt-in refusal fallback: on a policy decline the API re-runs the
        // request on a suitable model inside the same call.
        fallbacks: 'default',
        messages,
      })
      .finalMessage()
    allContent.push(...research.content)
    if (research.stop_reason !== 'pause_turn') break
    // Resume a paused server-side search: send the paused turn back as-is.
    messages.push({ role: 'assistant', content: research.content })
  }
  if (!research || research.stop_reason === 'refusal' || research.stop_reason === 'pause_turn') {
    console.warn('system topics: research did not finish', research?.stop_reason)
    return []
  }

  const notes = allContent
    .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
    .map(b => b.text)
    .join('\n')
    .trim()
  const allowed = searchedUrls(allContent)
  if (!notes || allowed.size === 0) return []

  // ─── 2. Structure ───
  const structured = await anthropic.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    system: 'Convert research notes into discussion topics. Use only facts and URLs present in the notes. Omit any pick whose sources are missing.',
    messages: [{ role: 'user', content: `Notes:\n\n${notes}\n\nReturn at most ${count} topics.` }],
    output_config: { format: jsonSchemaOutputFormat(SCHEMA) },
  })
  if (structured.stop_reason === 'refusal' || !structured.parsed_output) return []

  return structured.parsed_output.topics
    .map(t => ({
      kind: t.kind,
      title: t.title,
      why: t.why,
      // Keep only links the search really returned.
      sources: t.sources.filter(s => allowed.has(s.url)),
    }))
    .filter(t => t.title.trim() && t.why.trim() && t.sources.length > 0)
    .slice(0, count)
}
