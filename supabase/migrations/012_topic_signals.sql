-- ============================================================
-- Migration 012: Topic signals — one-tap, zero-writing response
-- ============================================================
--
-- Why: with ~30 members and fewer than 10 contributing, the barrier is not
-- missing discussion UI (comments already do threading, markdown, reactions)
-- — it is that every existing action is high-stakes or unavailable. Votes are
-- scarce (3/cycle) and lock at meeting_at; commenting means composing prose
-- under your name in front of colleagues.
--
-- Signals are unlimited, unscored, available in EVERY cycle phase including
-- the dead zone, and deliberately have no negative option. "explain_more" is
-- the important one: it lets a quiet member start a discussion without
-- writing anything.

-- ─── Table ───────────────────────────────────────────────────
CREATE TABLE public.topic_signals (
  topic_id   uuid        NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES public.users(id)  ON DELETE CASCADE,
  signal     text        NOT NULL CHECK (signal IN ('curious','would_attend','explain_more','done_this')),
  created_at timestamptz NOT NULL DEFAULT now(),

  -- One row per (member, topic, signal); a member may send several different
  -- signals on the same topic.
  PRIMARY KEY (topic_id, user_id, signal)
);

CREATE INDEX idx_topic_signals_topic ON public.topic_signals (topic_id);

-- ─── RLS ─────────────────────────────────────────────────────
ALTER TABLE public.topic_signals ENABLE ROW LEVEL SECURITY;

-- Counts are public (that is the point), so blanket authenticated SELECT is
-- correct here — unlike idea_bank, there is nothing private in a signal.
CREATE POLICY "topic_signals_select" ON public.topic_signals
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "topic_signals_insert_own" ON public.topic_signals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "topic_signals_delete_own" ON public.topic_signals
  FOR DELETE USING (auth.uid() = user_id);

-- NOTE: deliberately NOT added to the supabase_realtime publication. Rows
-- carry user_id, and broadcasting them would tell every client exactly who
-- tapped "explain_more" on whose topic. Clients poll the aggregate instead.
