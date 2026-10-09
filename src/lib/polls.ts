import type { SupabaseClient } from '@supabase/supabase-js'
import type { PollInput, TopicPoll } from '@/types'

export const POLL_QUESTION_MAX = 140
export const POLL_OPTION_MAX = 60
export const POLL_MIN_OPTIONS = 2
export const POLL_MAX_OPTIONS = 4

/**
 * Validate a poll from a request body. Returns the cleaned poll, or an error
 * message for a 400. Blank options are dropped before counting, so a form
 * with an empty fourth row is still a valid three-option poll.
 */
export function parsePollInput(raw: unknown): { poll: PollInput } | { error: string } {
  if (!raw || typeof raw !== 'object') return { error: 'Invalid poll' }
  const { question, options } = raw as { question?: unknown; options?: unknown }

  const q = typeof question === 'string' ? question.trim() : ''
  if (q.length < 3) return { error: 'Poll question is too short' }
  if (q.length > POLL_QUESTION_MAX) return { error: `Poll question must be under ${POLL_QUESTION_MAX} characters` }

  if (!Array.isArray(options)) return { error: 'Poll options are required' }
  const opts = options
    .map(o => (typeof o === 'string' ? o.trim() : ''))
    .filter(Boolean)
  if (opts.length < POLL_MIN_OPTIONS) return { error: `A poll needs at least ${POLL_MIN_OPTIONS} options` }
  if (opts.length > POLL_MAX_OPTIONS) return { error: `A poll can have at most ${POLL_MAX_OPTIONS} options` }
  if (opts.some(o => o.length > POLL_OPTION_MAX)) return { error: `Options must be under ${POLL_OPTION_MAX} characters` }
  if (new Set(opts.map(o => o.toLowerCase())).size !== opts.length) return { error: 'Poll options must be different' }

  return { poll: { question: q, options: opts } }
}

/** Create a topic's poll. Service-role client: members cannot write polls. */
export async function createPoll(admin: SupabaseClient, topicId: string, poll: PollInput): Promise<string | null> {
  const { data, error } = await admin
    .from('topic_polls')
    .insert({ topic_id: topicId, question: poll.question })
    .select('id')
    .single()
  if (error || !data) return error?.message ?? 'Could not create poll'

  const { error: optErr } = await admin
    .from('poll_options')
    .insert(poll.options.map((label, position) => ({ poll_id: data.id, position, label })))
  if (optErr) {
    await admin.from('topic_polls').delete().eq('id', data.id)
    return optErr.message
  }
  return null
}

/**
 * Replace or remove a topic's poll. Only while nobody has voted: changing the
 * options under existing votes would silently change what people said.
 */
export async function replacePoll(
  admin: SupabaseClient,
  topicId: string,
  poll: PollInput | null,
): Promise<string | null> {
  const { data: existing } = await admin
    .from('topic_polls')
    .select('id, total_votes')
    .eq('topic_id', topicId)
    .maybeSingle()

  if (existing && existing.total_votes > 0) return 'People have already voted, so the poll is locked'
  if (existing) await admin.from('topic_polls').delete().eq('id', existing.id)
  return poll ? createPoll(admin, topicId, poll) : null
}

/**
 * Polls for a set of topics, shaped for one viewer.
 *
 * Per-option counts are included only when the viewer has voted or voting has
 * closed. Before that the viewer sees the question, the options and the total,
 * so the first votes are not just following the crowd. Who voted for what is
 * never returned to anyone.
 */
export async function loadPolls(
  admin: SupabaseClient,
  topicIds: string[],
  viewerId: string,
  votingOpen: boolean,
): Promise<Map<string, TopicPoll>> {
  const out = new Map<string, TopicPoll>()
  if (topicIds.length === 0) return out

  const { data: polls } = await admin
    .from('topic_polls')
    .select('id, topic_id, question, total_votes, poll_options(id, position, label, vote_count)')
    .in('topic_id', topicIds)
  if (!polls?.length) return out

  const { data: mine } = await admin
    .from('poll_votes')
    .select('poll_id, option_id')
    .eq('user_id', viewerId)
    .in('poll_id', polls.map(p => p.id))
  const myVote = new Map((mine ?? []).map(v => [v.poll_id, v.option_id as string]))

  for (const p of polls) {
    const myOptionId = myVote.get(p.id) ?? null
    const resultsVisible = myOptionId !== null || !votingOpen
    const options = [...(p.poll_options ?? [])]
      .sort((a, b) => a.position - b.position)
      .map(o => ({ id: o.id, label: o.label, votes: resultsVisible ? o.vote_count : null }))

    out.set(p.topic_id, {
      id: p.id,
      question: p.question,
      total_votes: p.total_votes,
      options,
      my_option_id: myOptionId,
      results_visible: resultsVisible,
      voting_open: votingOpen,
    })
  }
  return out
}
