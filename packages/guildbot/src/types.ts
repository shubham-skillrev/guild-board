/**
 * Everything GuildBot knows about the world arrives through these types.
 * The host app builds them from sanitized reads, so nothing here can carry a
 * user id, a real name, an email, or who is behind a ghost handle.
 */

/** How the bot feels about the board right now. Picks which lines it uses. */
export type Mood = 'proud' | 'smug' | 'bored' | 'dramatic'

/** Where a line will be shown. Decides which guard rules apply. */
export type Surface = 'comment' | 'reply' | 'slack' | 'push' | 'ui' | 'chat'

/** Board facts the bot may react to. Counts only. */
export interface BoardStats {
  daysSinceOpen: number
  /** null when no meeting is scheduled yet. */
  daysToMeeting: number | null
  humanPosts: number
  botPosts: number
}

/** A topic as the bot sees it. `author` is a public @username or a ghost handle. */
export interface TopicView {
  id: string
  title: string
  body: string
  kind: string
  author: string
  authorIsGhost: boolean
  /** The author opted into being teased by name, in the app only. */
  authorRoastMe: boolean
  voteCount: number
  commentCount: number
}

/**
 * The one model call the bot needs: JSON back against a schema, or null on any
 * failure. The host wraps whatever provider it uses.
 */
export interface LlmClient {
  json<T>(args: {
    system: string
    prompt: string
    schema: Record<string, unknown>
    label: string
    tier?: 'quality' | 'bulk'
  }): Promise<T | null>
}
