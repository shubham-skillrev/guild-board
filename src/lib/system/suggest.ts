import 'server-only'
import { geminiJson } from '@/lib/ai/gemini'
import { fetchCandidates, type Candidate } from '@/lib/bytes/sources'
import type { SystemTopicDraft } from '@/lib/system/topics'

/**
 * GuildBoard's monthly board suggestions, from this week's tech news.
 *
 * 1. Fetch the latest from our sources: Google News search on AI and
 *    engineering topics, the engineering blogs and talks, and Hacker News.
 * 2. Hand the whole pool to Gemini and ask for 3-5 discussion topics, each
 *    with a title and a description: 1-2 about AI, 2-3 about engineering.
 *
 * Grounding: every topic must cite pool items by id, and the links it gets
 * come from those items, never from the model. A topic citing nothing we
 * sent is dropped, and the AI/engineering split is enforced here as well as
 * in the prompt.
 */

/** How much of the pool the model sees, highest ranked first. */
const POOL_FOR_PROMPT = 80
const MIN_TOPICS = 3
const MAX_TOPICS = 5
const MAX_AI = 2
const MAX_ENGINEERING = 3

const SCHEMA = {
  type: 'object',
  properties: {
    topics: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          area: { type: 'string', enum: ['ai', 'engineering'] },
          kind: {
            type: 'string',
            enum: ['new_tech', 'take', 'learned'],
            description: 'new_tech for a release or tool; take for a debate; learned for a lesson or finding.',
          },
          title: { type: 'string', description: 'At most 80 characters. Plain and specific, no clickbait.' },
          description: {
            type: 'string',
            description: '2-4 sentences: what happened, drawn only from the cited items, and the question for the room.',
          },
          source_ids: {
            type: 'array',
            items: { type: 'string' },
            description: 'The source_id of every item this topic is based on. At least one.',
          },
        },
        required: ['area', 'kind', 'title', 'description', 'source_ids'],
      },
    },
  },
  required: ['topics'],
}

const SYSTEM = `You pick discussion topics for SkillRev's monthly engineering guild: about thirty software engineers who meet for an hour to talk tech.

You are given this week's tech news and engineering posts, each with a source_id. Choose between 3 and 5 topics in total:
- 1 or 2 topics about AI.
- 2 or 3 topics about software engineering (architecture, infrastructure, tooling, languages, security, data, practice).

A good topic is something engineers would genuinely want to argue about or try. Skip funding rounds, earnings, gadgets and consumer news. Merge items that cover the same story into one topic.

For each topic write a plain, specific title and a 2-4 sentence description that says what happened and ends with the question the room could discuss. Use only facts present in the items you cite, and cite every item you used by its source_id. Do not repeat anything already on the board. No hype words, no exclamation marks, no em dashes.`

export async function suggestSystemTopics(args: {
  monthLabel: string
  existingTitles: string[]
  count?: number
}): Promise<SystemTopicDraft[]> {
  const max = Math.min(args.count ?? MAX_TOPICS, MAX_TOPICS)

  const pool = (await fetchCandidates(8, 40))
    .sort((a, b) => b.score - a.score)
    .slice(0, POOL_FOR_PROMPT)
  if (pool.length === 0) return []
  const byId = new Map<string, Candidate>(pool.map(c => [c.source_id, c]))

  const items = pool.map(c => ({
    source_id: c.source_id,
    title: c.title,
    publisher: c.source_name,
    medium: c.source === 'video' ? 'video' : c.source === 'news' ? 'news' : 'article',
    excerpt: c.excerpt?.slice(0, 240) ?? null,
  }))

  const result = await geminiJson<{
    topics?: { area?: string; kind?: string; title?: string; description?: string; source_ids?: unknown }[]
  }>({
    label: 'system topics',
    system: SYSTEM,
    prompt: `It is ${args.monthLabel}.

Already on the board (do not repeat):
${args.existingTitles.map(t => `- ${t}`).join('\n') || '- (nothing yet)'}

This week's items:
${JSON.stringify(items)}`,
    schema: SCHEMA,
  })

  let ai = 0
  let eng = 0
  const out: SystemTopicDraft[] = []
  for (const t of result?.topics ?? []) {
    if (out.length >= max) break
    const title = t.title?.trim()
    const description = t.description?.trim()
    if (!title || !description) continue

    // Grounding: only items we actually sent, and at least one of them.
    const cited = (Array.isArray(t.source_ids) ? t.source_ids : [])
      .filter((id): id is string => typeof id === 'string')
      .map(id => byId.get(id))
      .filter((c): c is Candidate => !!c)
    if (cited.length === 0) continue

    // The split, enforced: 1-2 AI, 2-3 engineering.
    if (t.area === 'ai') {
      if (ai >= MAX_AI) continue
      ai++
    } else {
      if (eng >= MAX_ENGINEERING) continue
      eng++
    }

    const kind = t.kind === 'take' || t.kind === 'learned' ? t.kind : 'new_tech'
    out.push({
      kind,
      title,
      why: description,
      sources: cited.slice(0, 3).map(c => ({ name: c.source_name, url: c.url })),
    })
  }

  if (out.length < MIN_TOPICS) {
    console.warn(`system topics: only ${out.length} usable topics came back, posting none`)
    return []
  }
  return out
}
