import type { CategoryTag } from '@/types'

/**
 * What someone brings to the guild. GuildBoard is a place to talk tech, and a
 * problem is one kind of conversation among several, so the share form starts
 * by asking which kind, then asks the two questions that suit it.
 *
 * Stored in `topics.category` (migration 024). The older categories
 * (deep_dive, discussion, blog_idea, project_showcase) stay valid for past
 * posts and are still labelled by CATEGORY_LABELS.
 *
 * Each kind's second answer is folded into the description under its own bold
 * heading, the same shape Problem Month used, so no new columns.
 */
export type Kind = Extract<CategoryTag, 'problem' | 'learned' | 'new_tech' | 'take' | 'show_tell'>

export interface KindConfig {
  value: Kind
  label: string
  /** The form's title for this kind. */
  heading: string
  first: { label: string; example: string }
  second: { label: string; example: string; /** Heading it gets in the description. */ section: string }
  /** The vote, in this kind's voice ("me too" on a problem). */
  reaction: { idle: string; done: string; short: string }
}

export const KINDS: KindConfig[] = [
  {
    value: 'problem',
    label: 'Problem',
    heading: 'Share a problem',
    first: { label: "What's the problem?", example: 'CI takes 25 minutes and nobody knows which step is slow' },
    second: { label: 'What have you tried?', example: 'Cached node_modules, no change. Haven’t profiled the test step yet.', section: "What I've tried" },
    reaction: { idle: "I've hit this too", done: "You've hit this", short: 'hit this' },
  },
  {
    value: 'learned',
    label: 'Learned',
    heading: 'Share something you learned',
    first: { label: 'What did you learn?', example: 'Postgres advisory locks replaced our Redis mutex' },
    second: { label: 'Where did it come up?', example: 'Two workers kept double-processing jobs. One lock, no extra infra.', section: 'Where it came up' },
    reaction: { idle: 'Want to discuss', done: 'You want to discuss', short: 'discuss' },
  },
  {
    value: 'new_tech',
    label: 'New tech',
    heading: 'Share some new tech',
    first: { label: 'What are you looking at?', example: 'Ran Bun in production for a week' },
    second: { label: "What's interesting about it?", example: 'Cold starts halved. Two npm packages broke in odd ways.', section: "What's interesting" },
    reaction: { idle: 'Want to discuss', done: 'You want to discuss', short: 'discuss' },
  },
  {
    value: 'take',
    label: 'Take',
    heading: 'Share a take',
    first: { label: "What's your take?", example: 'Most of our microservices should have been a module' },
    second: { label: 'Why do you think so?', example: 'Three of them deploy together every time and share one database.', section: 'Why' },
    reaction: { idle: 'Want to discuss', done: 'You want to discuss', short: 'discuss' },
  },
  {
    value: 'show_tell',
    label: 'Show & tell',
    heading: 'Show something you built',
    first: { label: 'What did you build?', example: 'A CLI that writes our release notes from merged PRs' },
    second: { label: 'What should people look at?', example: 'The prompt that groups commits. Repo link inside.', section: 'What to look at' },
    reaction: { idle: 'Want to discuss', done: 'You want to discuss', short: 'discuss' },
  },
]

const BY_VALUE = new Map(KINDS.map(k => [k.value, k]))

export function kindOf(category: string | null | undefined): KindConfig | undefined {
  return category ? BY_VALUE.get(category as Kind) : undefined
}

/** Reaction wording for any post. Older categories get the neutral wording. */
export function reactionFor(category: string | null | undefined): KindConfig['reaction'] {
  return kindOf(category)?.reaction ?? KINDS[1].reaction
}

/** Build the stored description from the kind's second answer and optional context. */
export function composeDescription(kind: KindConfig, second: string, context: string): string {
  const parts = [`**${kind.second.section}**\n${second.trim()}`]
  if (context.trim()) parts.push(`**Context**\n${context.trim()}`)
  return parts.join('\n\n')
}
