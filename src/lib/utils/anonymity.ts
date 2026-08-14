import { createHash } from 'crypto'

/**
 * Ghost handles for topics posted anonymously.
 *
 * IMPORTANT: anonymity here is enforced at API serialization, NOT by RLS.
 * Migration 003 grants blanket authenticated SELECT on `users`, so any client
 * can join author ids back to usernames. The only real protection is never
 * sending `user_id` for a ghost topic in the first place - see serializeTopic.
 *
 * The handle is derived from (user_id, topic_id), so it is stable within one
 * topic (a thread stays followable) but unlinkable across topics.
 *
 * This is plausible deniability, not unlinkability - in a guild this size,
 * writing style identifies people. UI copy says "ghost", never "anonymous".
 */
export function ghostHandle(userId: string, topicId: string): string {
  const digest = createHash('md5').update(`${userId}:${topicId}`).digest('hex')
  return `ghost_${digest.slice(0, 6)}`
}

/**
 * The fields the serializer needs. Deliberately has no index signature so
 * Supabase's inferred row types satisfy it without a cast.
 */
type RawTopic = {
  id: string
  user_id: string
  is_anonymous?: boolean | null
  users?: { username?: string } | { username?: string }[] | null
}

/** Supabase returns a joined to-one relation as an object or a 1-element array. */
export function joinedUsername(joined: RawTopic['users']): string | null {
  if (Array.isArray(joined)) return joined[0]?.username ?? null
  if (joined && typeof joined === 'object') return joined.username ?? null
  return null
}

/**
 * Strip identity from a topic row before it leaves the server.
 *
 * For a ghost topic viewed by anyone other than its author, `user_id` is
 * DELETED from the payload - not blanked - so no client-side join can recover
 * it. Ownership and spark-targeting move to server-computed booleans because
 * the client can no longer derive them.
 *
 * Note admins are deliberately NOT exempt: an admin is a colleague here, and
 * the manager seeing through ghost posts would defeat the entire point.
 */
export function serializeTopic<T extends RawTopic>(topic: T, viewerId: string) {
  const isOwner = topic.user_id === viewerId
  const isGhost = topic.is_anonymous === true && !isOwner

  const { users: _joined, ...rest } = topic

  const base = {
    ...rest,
    is_owner: isOwner,
    // Sparks go to a person, and a ghost author is not addressable. Sparking is
    // a post-meeting act on named work, so this is an acceptable trade.
    can_spark_author: !isOwner && !isGhost,
  }

  if (isGhost) {
    const { user_id: _hidden, ...anonymous } = base
    return { ...anonymous, author_username: ghostHandle(topic.user_id, topic.id) }
  }

  return {
    ...base,
    author_username: topic.is_anonymous
      ? ghostHandle(topic.user_id, topic.id)
      : joinedUsername(topic.users) ?? 'unknown',
  }
}
