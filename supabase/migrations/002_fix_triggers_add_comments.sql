-- ============================================================
-- Migration 002: Fix trigger security + Add comments table
-- ============================================================

-- ─── FIX: Make all trigger functions SECURITY DEFINER ───
-- Without this, triggers run as the calling user who has no
-- UPDATE policy on topics/users, so vote_count never updates.
-- ============================================================

CREATE OR REPLACE FUNCTION check_vote_limit()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (
    SELECT COUNT(*) FROM public.votes
    WHERE user_id = NEW.user_id AND cycle_id = NEW.cycle_id
  ) >= 3 THEN
    RAISE EXCEPTION 'Vote limit reached: max 3 votes per cycle';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION check_topic_limit()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (
    SELECT COUNT(*) FROM public.topics
    WHERE user_id = NEW.user_id AND cycle_id = NEW.cycle_id AND is_deleted = FALSE
  ) >= 1 THEN
    RAISE EXCEPTION 'Topic limit reached: max 1 topic per cycle';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION check_contrib_limit()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF (
    SELECT COUNT(*) FROM public.contributions
    WHERE user_id = NEW.user_id AND cycle_id = NEW.cycle_id
  ) >= 2 THEN
    RAISE EXCEPTION 'Contribution limit reached: max 2 per cycle';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_vote_count()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_category TEXT;
  v_votes INTEGER;
  v_contribs INTEGER;
  v_base NUMERIC;
  v_bonus NUMERIC;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.topics SET vote_count = vote_count + 1 WHERE id = NEW.topic_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.topics SET vote_count = GREATEST(vote_count - 1, 0) WHERE id = OLD.topic_id;
  END IF;

  SELECT category, vote_count, contrib_count INTO v_category, v_votes, v_contribs
  FROM public.topics WHERE id = COALESCE(NEW.topic_id, OLD.topic_id);

  v_base := (v_votes * 1) + (v_contribs * 2);
  v_bonus := CASE WHEN v_category = 'deep_dive' THEN v_base * 0.10 ELSE 0 END;

  UPDATE public.topics SET score = v_base + v_bonus
  WHERE id = COALESCE(NEW.topic_id, OLD.topic_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_contrib_count()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_category TEXT;
  v_votes INTEGER;
  v_contribs INTEGER;
  v_base NUMERIC;
  v_bonus NUMERIC;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.topics SET contrib_count = contrib_count + 1 WHERE id = NEW.topic_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.topics SET contrib_count = GREATEST(contrib_count - 1, 0) WHERE id = OLD.topic_id;
  END IF;

  SELECT category, vote_count, contrib_count INTO v_category, v_votes, v_contribs
  FROM public.topics WHERE id = COALESCE(NEW.topic_id, OLD.topic_id);

  v_base := (v_votes * 1) + (v_contribs * 2);
  v_bonus := CASE WHEN v_category = 'deep_dive' THEN v_base * 0.10 ELSE 0 END;

  UPDATE public.topics SET score = v_base + v_bonus
  WHERE id = COALESCE(NEW.topic_id, OLD.topic_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION update_spark_count()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.users
  SET
    spark_count = spark_count + 1,
    hall_of_flame = (spark_count + 1 >= 5)
  WHERE id = NEW.to_user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- ============================================================
-- Add updated_at to topics
-- ============================================================
ALTER TABLE public.topics ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
ALTER TABLE public.topics ADD COLUMN IF NOT EXISTS comment_count INTEGER NOT NULL DEFAULT 0;

-- ============================================================
-- TABLE: comments (threaded, Reddit-style)
-- ============================================================
CREATE TABLE public.comments (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic_id   UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  parent_id  UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  body       TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
  is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_comments_topic_id ON public.comments(topic_id);
CREATE INDEX idx_comments_parent_id ON public.comments(parent_id);

-- ─── Trigger: Maintain topics.comment_count ───
CREATE OR REPLACE FUNCTION update_comment_count()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.topics SET comment_count = comment_count + 1 WHERE id = NEW.topic_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.topics SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = OLD.topic_id;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Soft delete: was not deleted, now is deleted
    IF OLD.is_deleted = FALSE AND NEW.is_deleted = TRUE THEN
      UPDATE public.topics SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = NEW.topic_id;
    END IF;
    -- Undelete: was deleted, now is not
    IF OLD.is_deleted = TRUE AND NEW.is_deleted = FALSE THEN
      UPDATE public.topics SET comment_count = comment_count + 1 WHERE id = NEW.topic_id;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_comment_change
AFTER INSERT OR DELETE OR UPDATE OF is_deleted ON public.comments
FOR EACH ROW EXECUTE FUNCTION update_comment_count();

-- ============================================================
-- RLS for comments
-- ============================================================
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read non-deleted comments" ON public.comments
  FOR SELECT USING (auth.role() = 'authenticated' AND is_deleted = FALSE);

CREATE POLICY "Authenticated users can insert own comment" ON public.comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own comment" ON public.comments
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- Add UPDATE policy on topics for owner edits
-- ============================================================
CREATE POLICY "Users can update own topic" ON public.topics
  FOR UPDATE USING (auth.uid() = user_id);

-- ============================================================
-- Enable realtime on topics table
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.topics;
