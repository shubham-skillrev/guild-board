export const TOKEN_LIMITS = {
  VOTES_PER_CYCLE: 3,
  CONTRIBS_PER_CYCLE: 2,
  SPARKS_PER_CYCLE: 1,
  TOPICS_PER_CYCLE: 1,
} as const

export const CATEGORY_LABELS: Record<string, string> = {
  deep_dive: 'Deep Dive',
  discussion: 'Discussion',
  blog_idea: 'Blog Idea',
  project_showcase: 'Project Showcase',
}

export const CATEGORY_BONUS: Record<string, number> = {
  deep_dive: 0.10, // +10% of base score
  discussion: 0,
  blog_idea: 0,
  project_showcase: 0,
}

export const OUTCOME_LABELS: Record<string, string> = {
  discussed: 'Discussed',
  blog_born: 'Blog Born',
  project_started: 'Project Started',
  carry_forward: 'Carry Forward',
  dropped: 'Dropped',
}

export const TITLE_MAX_LENGTH = 80
export const DESCRIPTION_MAX_LENGTH = 1000
export const OUTCOME_NOTE_MAX_LENGTH = 500

export const SPARK_WINDOW_HOURS = 48
export const CARRY_FORWARD_MIN_VOTES = 2

export const MAX_SELECTED_TOPICS = 10 // Maximum topics admin can select per cycle

export const HALL_OF_FLAME_THRESHOLD = 5 // Sparks needed for badge (admin-configurable in V2)
