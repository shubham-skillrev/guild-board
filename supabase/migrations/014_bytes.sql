-- ============================================================
-- Migration 014: Bytes - monthly tech news digest
-- ============================================================
--
-- Why: the guild runs out of topics, and the board is dead mid-cycle. A short
-- digest of what actually happened in tech since the last meeting gives people
-- a reason to open the app between meetings and seeds the topic funnel.
--
-- Integrity model: source_title and url are copied VERBATIM from the feed
-- response. The LLM is only ever asked for `summary` and `tags`, and its
-- output is schema-constrained so it cannot return a title or a URL at all.
-- A fabricated headline is therefore structurally impossible, not merely
-- discouraged by the prompt.

-- ─── Digest (one per cycle, admin-reviewed before publish) ───
CREATE TABLE public.byte_digests (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id     uuid        REFERENCES public.cycles(id) ON DELETE SET NULL,
  label        text        NOT NULL,
  status       text        NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  created_by   uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  published_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_byte_digests_published
  ON public.byte_digests (published_at DESC)
  WHERE status = 'published';

-- ─── Individual byte ─────────────────────────────────────────
CREATE TABLE public.bytes (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  digest_id     uuid        NOT NULL REFERENCES public.byte_digests(id) ON DELETE CASCADE,

  -- GROUNDING: copied verbatim from the feed. Never LLM-authored.
  source        text        NOT NULL CHECK (source IN ('hn','devto','github')),
  source_id     text        NOT NULL,
  source_title  text        NOT NULL,
  url           text        NOT NULL,
  source_points integer,

  -- The ONLY two columns the LLM writes.
  summary       text        CHECK (summary IS NULL OR char_length(summary) <= 400),
  tags          text[],

  -- Human commentary. The thing that makes a digest actually get read.
  editor_note   text        CHECK (editor_note IS NULL OR char_length(editor_note) <= 300),

  seeded_topic_id uuid      REFERENCES public.topics(id) ON DELETE SET NULL,
  interest_count  integer   NOT NULL DEFAULT 0,
  position      smallint    NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),

  UNIQUE (digest_id, source, source_id)
);

CREATE INDEX idx_bytes_digest ON public.bytes (digest_id, position);

-- ─── One-tap "I'd discuss this" ──────────────────────────────
CREATE TABLE public.byte_interests (
  byte_id    uuid        NOT NULL REFERENCES public.bytes(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (byte_id, user_id)
);

-- Counter trigger - mirrors sync_comment_reaction_counts() in migration 007.
CREATE OR REPLACE FUNCTION public.sync_byte_interest_count()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.bytes SET interest_count = interest_count + 1 WHERE id = NEW.byte_id;
  ELSE
    UPDATE public.bytes SET interest_count = GREATEST(interest_count - 1, 0) WHERE id = OLD.byte_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_byte_interest_count
  AFTER INSERT OR DELETE ON public.byte_interests
  FOR EACH ROW EXECUTE FUNCTION public.sync_byte_interest_count();

-- ─── RLS ─────────────────────────────────────────────────────
ALTER TABLE public.byte_digests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bytes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.byte_interests ENABLE ROW LEVEL SECURITY;

-- Drafts are invisible to members; admin routes read via the service-role
-- client, which bypasses RLS.
CREATE POLICY "byte_digests_select_published" ON public.byte_digests
  FOR SELECT USING (auth.role() = 'authenticated' AND status = 'published');

CREATE POLICY "bytes_select_published" ON public.bytes
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND EXISTS (
      SELECT 1 FROM public.byte_digests d
      WHERE d.id = bytes.digest_id AND d.status = 'published'
    )
  );

CREATE POLICY "byte_interests_select" ON public.byte_interests
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "byte_interests_insert_own" ON public.byte_interests
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "byte_interests_delete_own" ON public.byte_interests
  FOR DELETE USING (auth.uid() = user_id);
