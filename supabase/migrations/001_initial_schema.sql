-- ============================================================
-- GuildBoard V1 — Initial Schema
-- All tables use UUID PKs and timestamptz created_at
-- RLS is enabled on every table
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- TABLE: users
-- Maps 1:1 with Supabase auth.users
-- ============================================================
CREATE TABLE public.users (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username      TEXT UNIQUE NOT NULL,
  real_name     TEXT,
  email         TEXT UNIQUE NOT NULL,
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  spark_count   INTEGER NOT NULL DEFAULT 0,
  hall_of_flame BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: cycles
-- ============================================================
CREATE TABLE public.cycles (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  label           TEXT NOT NULL,
  month           INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
  year            INTEGER NOT NULL,
  status          TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('upcoming', 'open', 'frozen', 'closed')),
  opens_at        TIMESTAMPTZ,
  freezes_at      TIMESTAMPTZ,
  meeting_at      TIMESTAMPTZ,
  spark_closes_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: topics
-- ============================================================
CREATE TABLE public.topics (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  cycle_id        UUID NOT NULL REFERENCES public.cycles(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  is_anonymous    BOOLEAN NOT NULL DEFAULT FALSE,
  title           TEXT NOT NULL CHECK (char_length(title) <= 80),
  description     TEXT NOT NULL CHECK (char_length(description) <= 300),
  category        TEXT NOT NULL CHECK (category IN ('deep_dive', 'discussion', 'blog_idea', 'project_showcase')),
  vote_count      INTEGER NOT NULL DEFAULT 0,
  contrib_count   INTEGER NOT NULL DEFAULT 0,
  score           NUMERIC NOT NULL DEFAULT 0,
  is_selected     BOOLEAN NOT NULL DEFAULT FALSE,
  is_deleted      BOOLEAN NOT NULL DEFAULT FALSE,
  status          TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'selected', 'carry_forward', 'dropped')),
  outcome_tag     TEXT CHECK (outcome_tag IN ('discussed', 'blog_born', 'project_started', 'carry_forward', 'dropped')),
  outcome_note    TEXT CHECK (char_length(outcome_note) <= 500),
  override_reason TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- TABLE: votes
-- ============================================================
CREATE TABLE public.votes (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic_id   UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  cycle_id   UUID NOT NULL REFERENCES public.cycles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (topic_id, user_id)
);

-- ============================================================
-- TABLE: contributions
-- ============================================================
CREATE TABLE public.contributions (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  topic_id   UUID NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  cycle_id   UUID NOT NULL REFERENCES public.cycles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (topic_id, user_id)
);

-- ============================================================
-- TABLE: sparks
-- ============================================================
CREATE TABLE public.sparks (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  from_user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  to_user_id   UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  cycle_id     UUID NOT NULL REFERENCES public.cycles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (from_user_id, cycle_id)
);

-- ============================================================
-- DB FUNCTIONS — Token enforcement
-- ============================================================

-- Enforce max 3 votes per user per cycle before inserting a vote
CREATE OR REPLACE FUNCTION check_vote_limit()
RETURNS TRIGGER AS $$
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

CREATE TRIGGER enforce_vote_limit
BEFORE INSERT ON public.votes
FOR EACH ROW EXECUTE FUNCTION check_vote_limit();

-- Enforce max 1 topic per user per cycle
CREATE OR REPLACE FUNCTION check_topic_limit()
RETURNS TRIGGER AS $$
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

CREATE TRIGGER enforce_topic_limit
BEFORE INSERT ON public.topics
FOR EACH ROW EXECUTE FUNCTION check_topic_limit();

-- Enforce max 2 contributions per user per cycle
CREATE OR REPLACE FUNCTION check_contrib_limit()
RETURNS TRIGGER AS $$
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

CREATE TRIGGER enforce_contrib_limit
BEFORE INSERT ON public.contributions
FOR EACH ROW EXECUTE FUNCTION check_contrib_limit();

-- ============================================================
-- DB TRIGGERS — Denormalized counter maintenance
-- ============================================================

-- Update topics.vote_count and topics.score on vote insert/delete
CREATE OR REPLACE FUNCTION update_vote_count()
RETURNS TRIGGER AS $$
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

  -- Recalculate score
  SELECT category, vote_count, contrib_count INTO v_category, v_votes, v_contribs
  FROM public.topics WHERE id = COALESCE(NEW.topic_id, OLD.topic_id);

  v_base := (v_votes * 1) + (v_contribs * 2);
  v_bonus := CASE WHEN v_category = 'deep_dive' THEN v_base * 0.10 ELSE 0 END;

  UPDATE public.topics SET score = v_base + v_bonus
  WHERE id = COALESCE(NEW.topic_id, OLD.topic_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_vote_change
AFTER INSERT OR DELETE ON public.votes
FOR EACH ROW EXECUTE FUNCTION update_vote_count();

-- Update topics.contrib_count and score on contribution insert/delete
CREATE OR REPLACE FUNCTION update_contrib_count()
RETURNS TRIGGER AS $$
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

CREATE TRIGGER on_contrib_change
AFTER INSERT OR DELETE ON public.contributions
FOR EACH ROW EXECUTE FUNCTION update_contrib_count();

-- Increment users.spark_count on spark insert and check hall_of_flame threshold
CREATE OR REPLACE FUNCTION update_spark_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.users
  SET
    spark_count = spark_count + 1,
    hall_of_flame = (spark_count + 1 >= 5)
  WHERE id = NEW.to_user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_spark_given
AFTER INSERT ON public.sparks
FOR EACH ROW EXECUTE FUNCTION update_spark_count();

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cycles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sparks ENABLE ROW LEVEL SECURITY;

-- users: anyone authenticated can read public fields; only service role sees real_name/email
CREATE POLICY "Users can read own row" ON public.users
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own username" ON public.users
  FOR UPDATE USING (auth.uid() = id);

-- cycles: all authenticated users can read
CREATE POLICY "Authenticated users can read cycles" ON public.cycles
  FOR SELECT USING (auth.role() = 'authenticated');

-- topics: authenticated can read non-deleted topics; owner can insert; service role manages rest
CREATE POLICY "Authenticated users can read active topics" ON public.topics
  FOR SELECT USING (auth.role() = 'authenticated' AND is_deleted = FALSE);

CREATE POLICY "Authenticated users can insert own topic" ON public.topics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- votes: user can insert/delete own votes; all can read vote_count (via topics)
CREATE POLICY "Users can manage own votes" ON public.votes
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can read votes" ON public.votes
  FOR SELECT USING (auth.role() = 'authenticated');

-- contributions: same pattern as votes
CREATE POLICY "Users can manage own contributions" ON public.contributions
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can read contributions" ON public.contributions
  FOR SELECT USING (auth.role() = 'authenticated');

-- sparks: authenticated can insert own spark; all can read
CREATE POLICY "Users can insert own spark" ON public.sparks
  FOR INSERT WITH CHECK (auth.uid() = from_user_id);

CREATE POLICY "Authenticated users can read sparks" ON public.sparks
  FOR SELECT USING (auth.role() = 'authenticated');
