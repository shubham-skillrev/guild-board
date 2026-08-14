-- ============================================================
-- Migration 011: Idea Bank - always-open idea capture
-- ============================================================
--
-- Why: submission is gated on isSubmissionAllowed() = open cycle AND before
-- meeting_at, so the board goes read-only the moment a meeting starts and
-- stays that way until an admin manually opens the next cycle - roughly 25
-- days a month. An idea you have on day 20 has nowhere to go and is gone by
-- the next cycle. That, plus the 1-topic-per-cycle cap, is why the guild
-- "runs out of topics".
--
-- The bank is unlimited and available in every cycle phase. Promotion to the
-- live voting board still inserts into topics, so check_topic_limit() keeps
-- enforcing 1 per cycle - the anti-spam intent of the cap survives untouched.
-- Do NOT relax that trigger.

-- ─── Table ───────────────────────────────────────────────────
CREATE TABLE public.idea_bank (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES public.users(id)  ON DELETE CASCADE,
  title             text        NOT NULL CHECK (char_length(title) BETWEEN 3 AND 80),
  note              text        CHECK (note IS NULL OR char_length(note) <= 500),
  category          text        CHECK (category IN ('deep_dive','discussion','blog_idea','project_showcase')),

  -- "Up for grabs": anyone may promote it. The lowest-stakes way to
  -- contribute - a one-line idea in a shared pool, no pitch, no vote count.
  is_open           boolean     NOT NULL DEFAULT false,

  -- Carried onto the promoted topic so a shy member can seed the board
  -- without attaching their name to it.
  is_anonymous      boolean     NOT NULL DEFAULT false,

  -- Set once promoted; the row is kept for provenance rather than deleted.
  promoted_topic_id uuid        REFERENCES public.topics(id) ON DELETE SET NULL,
  promoted_by       uuid        REFERENCES public.users(id)  ON DELETE SET NULL,
  promoted_at       timestamptz,

  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

-- ─── Indexes ─────────────────────────────────────────────────
-- Open-ideas pool: unpromoted rows others can claim.
CREATE INDEX idx_idea_bank_open
  ON public.idea_bank (created_at DESC)
  WHERE is_open = true AND promoted_topic_id IS NULL;

-- A member's own bank, newest first.
CREATE INDEX idx_idea_bank_user
  ON public.idea_bank (user_id, created_at DESC);

-- ─── RLS ─────────────────────────────────────────────────────
ALTER TABLE public.idea_bank ENABLE ROW LEVEL SECURITY;

-- Own drafts are private; open ideas are visible to the whole guild.
-- Note this deliberately does NOT use the blanket authenticated-SELECT
-- pattern used elsewhere: a private bank must stay private.
CREATE POLICY "idea_bank_select" ON public.idea_bank
  FOR SELECT USING (auth.uid() = user_id OR is_open = true);

CREATE POLICY "idea_bank_insert_own" ON public.idea_bank
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "idea_bank_update_own" ON public.idea_bank
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "idea_bank_delete_own" ON public.idea_bank
  FOR DELETE USING (auth.uid() = user_id);

-- ─── Trigger: maintain updated_at ────────────────────────────
CREATE OR REPLACE FUNCTION public.touch_idea_bank()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_touch_idea_bank
  BEFORE UPDATE ON public.idea_bank
  FOR EACH ROW EXECUTE FUNCTION public.touch_idea_bank();

-- ─── Guard: an idea can only be promoted once ────────────────
-- Two members can open the same "up for grabs" idea concurrently; without
-- this the loser's promotion would silently overwrite the winner's link and
-- both would hold a topic against the same bank row.
CREATE OR REPLACE FUNCTION public.check_idea_bank_promotion()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.promoted_topic_id IS NOT NULL
     AND OLD.promoted_topic_id IS NOT NULL
     AND NEW.promoted_topic_id <> OLD.promoted_topic_id THEN
    RAISE EXCEPTION 'Idea already promoted';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_idea_bank_promotion
  BEFORE UPDATE ON public.idea_bank
  FOR EACH ROW EXECUTE FUNCTION public.check_idea_bank_promotion();
