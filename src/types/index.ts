// src/types/index.ts

export type UserRole = 'user' | 'admin'

export type CycleStatus = 'upcoming' | 'open' | 'frozen' | 'closed'

export type CategoryTag = 'deep_dive' | 'discussion' | 'blog_idea' | 'project_showcase'

export type TopicStatus = 'active' | 'selected' | 'carry_forward' | 'dropped'

export type OutcomeTag = 'discussed' | 'blog_born' | 'project_started' | 'carry_forward' | 'dropped'

export interface User {
  id: string
  username: string
  real_name: string         // Admin-visible only
  email: string             // Admin-visible only
  role: UserRole
  spark_count: number
  hall_of_flame: boolean
  created_at: string
}

export interface PublicUser {
  id: string
  username: string
  spark_count: number
  hall_of_flame: boolean
}

export interface Cycle {
  id: string
  label: string
  month: number
  year: number
  status: CycleStatus
  opens_at: string | null
  freezes_at: string | null
  meeting_at: string | null
  spark_closes_at: string | null
  created_at: string
}

export interface Topic {
  id: string
  cycle_id: string
  /**
   * Author id. OMITTED by the API for ghost topics when the viewer is not the
   * author (see src/lib/utils/anonymity.ts). Never rely on this for ownership
   * or self-checks — use `is_owner` / `can_spark_author` instead.
   */
  user_id?: string
  is_anonymous: boolean
  title: string
  description: string
  category: CategoryTag
  vote_count: number
  contrib_count: number
  comment_count: number
  score: number
  is_selected: boolean
  is_deleted: boolean
  status: TopicStatus
  outcome_tag: OutcomeTag | null
  outcome_note: string | null
  override_reason: string | null
  created_at: string
  updated_at: string
  // Joined fields
  author_username?: string  // stable ghost handle if anonymous (for non-authors)
  /** Server-computed: viewer authored this topic. Survives ghost anonymity. */
  is_owner?: boolean
  /** Server-computed: viewer may spark this author (not themselves). */
  can_spark_author?: boolean
}

/**
 * A banked idea. Unlimited and capturable in any cycle phase — unlike topics,
 * which are capped at 1 per cycle and locked once a meeting starts.
 */
export interface BankedIdea {
  id: string
  user_id?: string            // omitted for anonymous open ideas
  title: string
  note: string | null
  category: CategoryTag | null
  is_open: boolean            // up for grabs — anyone may promote it
  is_anonymous: boolean
  promoted_topic_id: string | null
  promoted_by: string | null
  promoted_at: string | null
  created_at: string
  updated_at: string
  // Joined / server-computed
  author_username?: string
  is_owner?: boolean
}

export interface Comment {
  id: string
  topic_id: string
  user_id: string
  parent_id: string | null   // null = top-level, otherwise reply
  body: string
  is_deleted: boolean
  like_count: number
  dislike_count: number
  created_at: string
  updated_at: string
  // Joined fields
  author_username?: string
  user_reaction?: 1 | -1 | null  // current user's reaction
  replies?: Comment[]
}

export interface Vote {
  id: string
  topic_id: string
  user_id: string
  cycle_id: string
  created_at: string
}

export interface Contribution {
  id: string
  topic_id: string
  user_id: string
  cycle_id: string
  created_at: string
}

export interface Spark {
  id: string
  from_user_id: string
  to_user_id: string
  cycle_id: string
  created_at: string
}

export interface UserTokens {
  votes_remaining: number       // Max 3 per cycle
  contribs_remaining: number    // Max 2 per cycle
  spark_given: boolean          // True if user gave spark this cycle
  topic_submitted: boolean      // True if user submitted a topic this cycle
}

export interface TopicScore {
  topic_id: string
  raw_votes: number
  raw_contribs: number
  category_bonus: number
  final_score: number
}
