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

// ─── Topic signals ───────────────────────────────────────────
// One-tap responses. Unlimited, unscored, available in every cycle phase.
// Deliberately no negative option: a public downvote of a named colleague is
// exactly the risk that keeps quiet members quiet.
export const SIGNAL_KINDS = ['curious', 'would_attend', 'explain_more', 'done_this'] as const
export type SignalKind = (typeof SIGNAL_KINDS)[number]

export const SIGNAL_LABELS: Record<SignalKind, string> = {
  curious: 'Curious',
  would_attend: 'I’d attend',
  explain_more: 'Explain more',
  done_this: 'Done this',
}

/**
 * Each signal gets its own hue as well as its own glyph.
 *
 * Four emoji in a row differentiated on colour alone, with no labels, meant
 * nobody could tell 🤔 "explain more" from 🤔 "I doubt this". Two things fix
 * that: the label is always rendered now, and the tint is a second, redundant
 * cue rather than the only one.
 *
 * These are the four palette colours that already have a job, so no new colour
 * enters the system: indigo reads as attention, matcha as willingness, wisteria
 * as a question, saffron as something already done.
 */
export const SIGNAL_TONES: Record<SignalKind, string> = {
  curious: 'text-indigo-jp',
  would_attend: 'text-matcha',
  explain_more: 'text-wisteria',
  done_this: 'text-saffron',
}
