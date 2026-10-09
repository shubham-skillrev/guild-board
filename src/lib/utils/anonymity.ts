import { createHmac } from 'crypto'
import { isSystemUsername } from '@/lib/system/identity'

/**
 * Ghost handles for topics and comments posted anonymously.
 *
 * Two layers keep a ghost a ghost:
 *  1. The database never hands identifying columns to members. Migration 028
 *     revokes SELECT on topics.user_id, comments.user_id, idea_bank.user_id /
 *     promoted_by, topic_asks.asker_id and users.real_name / email, so a direct
 *     PostgREST query cannot join a ghost back to a person.
 *  2. The API reads those columns with the service role and strips them here
 *     before anything leaves the server.
 *
 * The handle is an HMAC of (user_id, topic_id) under a server-only secret. A
 * plain hash was not enough: both inputs are visible to members (user ids via
 * the users table, topic ids in every URL), so anyone could hash the whole
 * guild against a topic and find the match. With the secret, the handle is
 * stable within one topic (a thread stays followable) and unlinkable across
 * topics, and cannot be recomputed client-side.
 *
 * This is plausible deniability, not unlinkability - in a guild this size,
 * writing style identifies people. UI copy says "ghost", never "anonymous".
 */
function ghostSecret(): string {
  // A dedicated secret is preferred. The service-role key is a safe fallback
  // (it never reaches a browser) but rotating it would re-roll every handle.
  const secret =
    process.env.GHOST_HANDLE_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY
  if (!secret) throw new Error('GHOST_HANDLE_SECRET is not set')
  return secret
}

export function ghostHandle(userId: string, topicId: string): string {
  const digest = createHmac('sha256', ghostSecret()).update(`${userId}:${topicId}`).digest('hex')
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

  // GuildBot's suggestions, recognised by the reserved author name.
  const isSystem = !topic.is_anonymous && isSystemUsername(joinedUsername(topic.users))

  const base = {
    ...rest,
    is_owner: isOwner,
    is_system: isSystem,
    // Sparks go to a person, and a ghost author is not addressable. Sparking is
    // a post-meeting act on named work, so this is an acceptable trade. The
    // system is not a person either.
    can_spark_author: !isOwner && !isGhost && !isSystem,
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

/** Every topic column a member may read back after a write (028 hides user_id). */
export const MEMBER_TOPIC_FIELDS =
  'id,cycle_id,is_anonymous,title,description,category,vote_count,contrib_count,comment_count,score,is_selected,is_deleted,status,outcome_tag,outcome_note,override_reason,is_carry_forward,is_system,created_at,updated_at'

/** Remove `user_id` from a topic row returned to an admin or after a write. */
export function withoutAuthor<T extends { user_id?: string }>(row: T): Omit<T, 'user_id'> {
  const { user_id: _hidden, ...rest } = row
  return rest
}

type RawComment = {
  id: string
  user_id: string
  is_anonymous?: boolean | null
  users?: RawTopic['users']
}

/** The parent topic's identity facts, read with the service role. */
export type CommentTopicContext = { id: string; user_id: string; is_anonymous?: boolean | null }

/**
 * Whether a comment is shown under a ghost handle.
 *
 * A ghost topic's author always speaks as their ghost in their own thread,
 * whatever the toggle said: replying under their name would unmask the post.
 */
export function commentIsGhost(
  comment: { user_id: string; is_anonymous?: boolean | null },
  topic: CommentTopicContext,
): boolean {
  return comment.is_anonymous === true || (topic.is_anonymous === true && comment.user_id === topic.user_id)
}

/**
 * Strip identity from a comment row. `user_id` never leaves the server, for
 * any comment: ownership and moderation rights are sent as booleans instead.
 *
 * `is_op` marks the topic author. It is withheld when it would unmask someone:
 * the named author of a named topic leaving a ghost comment gets no badge,
 * because "OP" next to a ghost handle would name them.
 */
export function serializeComment<T extends RawComment>(
  comment: T,
  topic: CommentTopicContext,
  viewer: { id: string; isAdmin: boolean },
) {
  const { users: joined, user_id: authorId, ...rest } = comment
  const isGhost = commentIsGhost(comment, topic)
  const isTopicAuthor = authorId === topic.user_id
  const isOwner = authorId === viewer.id

  return {
    ...rest,
    is_anonymous: isGhost,
    // GuildBot's comments, recognised by its reserved name, as for topics.
    is_system: !isGhost && isSystemUsername(joinedUsername(joined)),
    is_owner: isOwner,
    is_op: isTopicAuthor && (topic.is_anonymous === true || !isGhost),
    can_delete: isOwner || viewer.isAdmin,
    author_username: isGhost ? ghostHandle(authorId, topic.id) : joinedUsername(joined) ?? 'unknown',
  }
}
