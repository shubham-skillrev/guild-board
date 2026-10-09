/**
 * Live update channels. Shared by the server publisher and the browser hooks
 * so the names cannot drift.
 *
 * Both are private Supabase Broadcast channels: members and guests may listen
 * (and share presence on a topic), only the service role may send (migration
 * 030). Payloads are viewer-agnostic counts plus a list of what changed.
 * Anything that depends on who is looking (comment ownership, ghost handles,
 * poll results) is never sent; clients refetch it through the API instead.
 */
export const boardChannel = (cycleId: string) => `board:${cycleId}`
export const topicChannel = (topicId: string) => `topic:${topicId}`

export const LIVE_EVENT = 'update'

/** What changed, so a client knows whether patching counts is enough. */
export type LiveChange =
  | 'counts'    // votes, comment count, score, signals: patch in place
  | 'comments'  // the thread changed: refetch it
  | 'poll'      // poll votes moved: refetch (results are per-viewer)
  | 'topics'    // a topic was posted, edited, hidden or selected: refetch
  | 'bot_typing' // GuildBot is writing a comment here: show it for a moment

export interface LiveCounts {
  vote_count: number
  comment_count: number
  score: number
  signal_counts: Record<string, number>
  poll_total: number | null
}

export interface LiveUpdate {
  topic_id: string | null
  changed: LiveChange[]
  counts: LiveCounts | null
}
