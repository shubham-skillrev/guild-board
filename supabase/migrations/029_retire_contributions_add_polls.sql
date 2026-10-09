-- ============================================================
-- Migration 029: Retire "I can help", add polls
-- ============================================================
--
-- 1. Score is votes only.
--    "I can help" (contributions) overlapped the vote and the "done this"
--    signal, and was one more button on a card that already had too many.
--    The button and its API are gone. The table and topics.contrib_count are
--    kept, read-only, so history survives; they just stop moving the board.
--    Both count triggers now compute score from votes alone, and existing
--    scores are recomputed once below.
--
-- 2. Polls.
--    One per topic, 2-4 options, single choice, changeable while voting is
--    open. Who voted for what is never readable by members: poll_votes has no
--    member grants at all, and the per-option counts are hidden too, so that
--    "results after you vote" holds even against a direct PostgREST query.
--    Members can read the question, the option labels and the poll's total.
--    The API serves per-option counts to people who have voted, or once
--    voting has closed.

-- ─── 1. Score from votes only ────────────────────────────────
CREATE OR REPLACE FUNCTION public.topic_score(p_votes integer, p_category text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  -- Mirrors calculateScore() in src/lib/utils/scoring.ts.
  SELECT p_votes + CASE WHEN p_category = 'deep_dive' THEN p_votes * 0.10 ELSE 0 END;
$$;

CREATE OR REPLACE FUNCTION update_vote_count()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.topics SET vote_count = vote_count + 1 WHERE id = NEW.topic_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.topics SET vote_count = GREATEST(vote_count - 1, 0) WHERE id = OLD.topic_id;
  END IF;

  UPDATE public.topics SET score = public.topic_score(vote_count, category)
  WHERE id = COALESCE(NEW.topic_id, OLD.topic_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Kept so stray rows (none are written any more) still count, but they no
-- longer feed the score.
CREATE OR REPLACE FUNCTION update_contrib_count()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.topics SET contrib_count = contrib_count + 1 WHERE id = NEW.topic_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.topics SET contrib_count = GREATEST(contrib_count - 1, 0) WHERE id = OLD.topic_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

UPDATE public.topics SET score = public.topic_score(vote_count, category);

-- No new contributions from members, even straight through PostgREST.
REVOKE INSERT, UPDATE, DELETE ON public.contributions FROM anon, authenticated;

-- ─── 2. Polls ────────────────────────────────────────────────
CREATE TABLE public.topic_polls (
  id          uuid        PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic_id    uuid        NOT NULL UNIQUE REFERENCES public.topics(id) ON DELETE CASCADE,
  question    text        NOT NULL CHECK (char_length(question) BETWEEN 3 AND 140),
  total_votes integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.poll_options (
  id         uuid     PRIMARY KEY DEFAULT uuid_generate_v4(),
  poll_id    uuid     NOT NULL REFERENCES public.topic_polls(id) ON DELETE CASCADE,
  position   smallint NOT NULL CHECK (position BETWEEN 0 AND 3),
  label      text     NOT NULL CHECK (char_length(label) BETWEEN 1 AND 60),
  vote_count integer  NOT NULL DEFAULT 0,
  UNIQUE (poll_id, position)
);

CREATE TABLE public.poll_votes (
  poll_id    uuid        NOT NULL REFERENCES public.topic_polls(id)  ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES public.users(id)        ON DELETE CASCADE,
  option_id  uuid        NOT NULL REFERENCES public.poll_options(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, user_id)
);

CREATE INDEX idx_poll_options_poll ON public.poll_options (poll_id, position);
CREATE INDEX idx_poll_votes_option ON public.poll_votes (option_id);

-- An option must belong to the poll being voted on.
CREATE OR REPLACE FUNCTION public.check_poll_vote_option()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.poll_options WHERE id = NEW.option_id AND poll_id = NEW.poll_id) THEN
    RAISE EXCEPTION 'Option does not belong to this poll';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_check_poll_vote_option
  BEFORE INSERT OR UPDATE OF option_id ON public.poll_votes
  FOR EACH ROW EXECUTE FUNCTION public.check_poll_vote_option();

-- Cached counts, same pattern as votes -> topics.vote_count.
CREATE OR REPLACE FUNCTION public.sync_poll_counts()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.poll_options SET vote_count = vote_count + 1 WHERE id = NEW.option_id;
    UPDATE public.topic_polls  SET total_votes = total_votes + 1 WHERE id = NEW.poll_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.poll_options SET vote_count = GREATEST(vote_count - 1, 0) WHERE id = OLD.option_id;
    UPDATE public.topic_polls  SET total_votes = GREATEST(total_votes - 1, 0) WHERE id = OLD.poll_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.option_id <> OLD.option_id THEN
    UPDATE public.poll_options SET vote_count = GREATEST(vote_count - 1, 0) WHERE id = OLD.option_id;
    UPDATE public.poll_options SET vote_count = vote_count + 1 WHERE id = NEW.option_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_sync_poll_counts
  AFTER INSERT OR UPDATE OF option_id OR DELETE ON public.poll_votes
  FOR EACH ROW EXECUTE FUNCTION public.sync_poll_counts();

-- ─── RLS + grants ────────────────────────────────────────────
ALTER TABLE public.topic_polls  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.poll_votes   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "topic_polls_select" ON public.topic_polls
  FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "poll_options_select" ON public.poll_options
  FOR SELECT USING (auth.role() = 'authenticated');
-- poll_votes: no member policy. Only the service role touches it.

REVOKE ALL ON public.topic_polls, public.poll_options, public.poll_votes FROM anon, authenticated;
GRANT SELECT (id, topic_id, question, total_votes, created_at) ON public.topic_polls TO authenticated;
GRANT SELECT (id, poll_id, position, label) ON public.poll_options TO authenticated;
