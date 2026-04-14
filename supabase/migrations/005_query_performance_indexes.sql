-- ============================================================
-- Migration 005: Query performance indexes for free-tier efficiency
-- Focus: common filters in board, tokens, comments, and cycle lookups.
-- ============================================================

-- Topics listing by cycle, ordered by score, only active records.
CREATE INDEX IF NOT EXISTS idx_topics_cycle_active_score
  ON public.topics (cycle_id, score DESC)
  WHERE is_deleted = FALSE;

-- User topic checks (token state + trigger checks) by cycle, active only.
CREATE INDEX IF NOT EXISTS idx_topics_user_cycle_active
  ON public.topics (user_id, cycle_id)
  WHERE is_deleted = FALSE;

-- Token checks and trigger checks for votes/contributions by user and cycle.
CREATE INDEX IF NOT EXISTS idx_votes_user_cycle
  ON public.votes (user_id, cycle_id);

CREATE INDEX IF NOT EXISTS idx_contributions_user_cycle
  ON public.contributions (user_id, cycle_id);

-- Comment thread reads by topic (active comments, chronological).
CREATE INDEX IF NOT EXISTS idx_comments_topic_active_created
  ON public.comments (topic_id, created_at)
  WHERE is_deleted = FALSE;

-- Fast lookup for "open cycle" checks used in board and topic creation flows.
CREATE INDEX IF NOT EXISTS idx_cycles_status_year_month
  ON public.cycles (status, year DESC, month DESC);
