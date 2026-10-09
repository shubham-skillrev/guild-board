import { guard } from './guard.ts'
import { EXAMPLES, PERSONA, REPLY_EXAMPLES, REVIEW_CHECKS } from './persona.ts'
import type { LlmClient, TopicView } from './types.ts'

/**
 * Model-written comments and replies. Three gates, all of which must pass,
 * and any doubt means the bot says nothing:
 *
 *  1. the persona prompt (persona.ts), with the approved examples;
 *  2. the deterministic guard (guard.ts);
 *  3. a second, cheaper model call that reviews the draft against the rules
 *     a regex cannot check: tone on problem posts, meanness, making sense.
 */

const COMMENT_SCHEMA = {
  type: 'object',
  properties: { comment: { type: 'string', description: 'The comment, or "" to stay quiet.' } },
  required: ['comment'],
}

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    approve: { type: 'boolean' },
    reason: { type: 'string' },
  },
  required: ['approve', 'reason'],
}

const REVIEW_SYSTEM = `You review a short message a bot wants to post on a company engineering discussion board. Approve only if ALL of these hold:
- It responds to the post it is under and makes sense on its own.
- If the post kind is "problem", the message is supportive and practical, with no jokes at the problem's expense.
- It names nobody, except a single @name listed as allowed.
${REVIEW_CHECKS}
When unsure, do not approve.`

/** Post text is user input. Fenced and labelled so the model treats it as data. */
function describePost(topic: TopicView): string {
  return JSON.stringify({
    kind: topic.kind,
    title: topic.title,
    body: topic.body.slice(0, 1500),
    posted_as_ghost: topic.authorIsGhost,
    // Only when the author opted in, and never for a ghost (the host enforces both).
    may_tease_by_name: topic.authorRoastMe && !topic.authorIsGhost ? topic.author : null,
    votes: topic.voteCount,
    comments: topic.commentCount,
  })
}

function examplesBlock(): string {
  return EXAMPLES.map(ex =>
    `POST: ${JSON.stringify({
      kind: ex.post.kind,
      title: ex.post.title,
      body: ex.post.body,
      posted_as_ghost: !!ex.post.ghost,
      may_tease_by_name: ex.post.roastMe ? `@${ex.post.roastMe}` : null,
    })}\nCOMMENT: ${ex.comment}`,
  ).join('\n\n')
}

async function review(llm: LlmClient, text: string, context: string, allowed: string[]): Promise<boolean> {
  const verdict = await llm.json<{ approve: boolean; reason: string }>({
    system: REVIEW_SYSTEM,
    prompt: `${context}\nALLOWED @NAMES: ${allowed.length ? allowed.map(a => `@${a}`).join(', ') : 'none'}\nMESSAGE: ${text}`,
    schema: REVIEW_SCHEMA,
    label: 'guildbot.review',
    tier: 'bulk',
  })
  return verdict?.approve === true
}

/*
 * Running bits get old fast if every comment uses one, and each comment is a
 * separate call with no memory of the others. So the code, not the model,
 * decides: about one comment in four may use a bit.
 */
export const BIT_CHANCE = 0.25

export function bitRule(bits: boolean): string {
  return bits
    ? 'For this comment you may use one running bit, if it genuinely fits.'
    : 'For this comment, do not use any running bit. Just react to the post in your own words.'
}

/** The @name the bot may use for this author, without the @. */
function allowedFor(topic: TopicView): string[] {
  return topic.authorRoastMe && !topic.authorIsGhost ? [topic.author.replace(/^@/, '')] : []
}

/**
 * A comment on someone's topic, or null to stay quiet. Null on any failure:
 * no model, a model that chose silence, the guard, or the review.
 */
export async function writeComment(
  llm: LlmClient,
  topic: TopicView,
  /** Whether this comment may use a running bit. Defaults to about one in four. */
  { bits = Math.random() < BIT_CHANCE }: { bits?: boolean } = {},
): Promise<string | null> {
  const allowed = allowedFor(topic)
  const draft = await llm.json<{ comment: string }>({
    system: `${PERSONA}\n\nExamples of your comments:\n\n${examplesBlock()}`,
    prompt: `Write one comment for this post. Return "" if you have nothing worth saying.\n${bitRule(bits)}\nPOST: ${describePost(topic)}`,
    schema: COMMENT_SCHEMA,
    label: 'guildbot.comment',
    tier: 'quality',
  })
  const text = draft?.comment?.trim()
  if (!text) return null

  const checked = guard(text, { surface: 'comment', allowedMentions: allowed })
  if (!checked.ok) return null
  return (await review(llm, checked.text, `POST: ${describePost(topic)}`, allowed)) ? checked.text : null
}

/**
 * The bot's one reply in a thread, to someone who answered it. `replier` is a
 * public @name or a ghost handle; `replierRoastMe` only for a named opt-in.
 */
export async function writeReply(
  llm: LlmClient,
  args: { topic: TopicView; botSaid: string; theySaid: string; replier: string; replierRoastMe: boolean },
): Promise<string | null> {
  const isGhost = /^ghost_/i.test(args.replier)
  const allowed = args.replierRoastMe && !isGhost ? [args.replier.replace(/^@/, '')] : []
  const examples = REPLY_EXAMPLES.map(r => `THEY SAID: ${r.said}\nYOU REPLIED: ${r.reply}`).join('\n\n')
  const context = JSON.stringify({
    post_kind: args.topic.kind,
    post_title: args.topic.title,
    you_said: args.botSaid.slice(0, 500),
    they_said: args.theySaid.slice(0, 800),
    may_tease_by_name: allowed[0] ? `@${allowed[0]}` : null,
  })

  const draft = await llm.json<{ comment: string }>({
    system: `${PERSONA}\n\nSomeone replied to your comment. You reply once, briefly, then let the humans talk.\n\nExamples:\n\n${examples}`,
    prompt: `Write your reply. Return "" if silence is better.\nTHREAD: ${context}`,
    schema: COMMENT_SCHEMA,
    label: 'guildbot.reply',
    tier: 'quality',
  })
  const text = draft?.comment?.trim()
  if (!text) return null

  const checked = guard(text, { surface: 'reply', allowedMentions: allowed })
  if (!checked.ok) return null
  return (await review(llm, checked.text, `THREAD: ${context}`, allowed)) ? checked.text : null
}
