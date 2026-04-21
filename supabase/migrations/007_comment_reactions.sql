-- ============================================================
-- Migration 007: Comment reactions (like / dislike)
-- ============================================================

-- ─── Table ───────────────────────────────────────────────────
CREATE TABLE public.comment_reactions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  comment_id  uuid        NOT NULL REFERENCES public.comments(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES public.users(id)    ON DELETE CASCADE,
  reaction    smallint    NOT NULL CHECK (reaction IN (1, -1)),
  created_at  timestamptz DEFAULT now(),

  UNIQUE (comment_id, user_id)  -- one reaction per user per comment
);

-- ─── Cached counts on comments table ─────────────────────────
ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS like_count    integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dislike_count integer NOT NULL DEFAULT 0;

-- ─── Trigger: keep counts in sync ────────────────────────────
CREATE OR REPLACE FUNCTION sync_comment_reaction_counts()
RETURNS TRIGGER
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.reaction = 1 THEN
      UPDATE public.comments SET like_count    = like_count    + 1 WHERE id = NEW.comment_id;
    ELSE
      UPDATE public.comments SET dislike_count = dislike_count + 1 WHERE id = NEW.comment_id;
    END IF;

  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.reaction = 1 THEN
      UPDATE public.comments SET like_count    = GREATEST(like_count    - 1, 0) WHERE id = OLD.comment_id;
    ELSE
      UPDATE public.comments SET dislike_count = GREATEST(dislike_count - 1, 0) WHERE id = OLD.comment_id;
    END IF;

  ELSIF TG_OP = 'UPDATE' THEN
    -- Reaction flipped (1 → -1 or vice versa)
    IF OLD.reaction = 1 AND NEW.reaction = -1 THEN
      UPDATE public.comments
        SET like_count    = GREATEST(like_count    - 1, 0),
            dislike_count = dislike_count + 1
        WHERE id = NEW.comment_id;
    ELSIF OLD.reaction = -1 AND NEW.reaction = 1 THEN
      UPDATE public.comments
        SET dislike_count = GREATEST(dislike_count - 1, 0),
            like_count    = like_count + 1
        WHERE id = NEW.comment_id;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_comment_reaction_counts ON public.comment_reactions;
CREATE TRIGGER trg_comment_reaction_counts
  AFTER INSERT OR UPDATE OR DELETE ON public.comment_reactions
  FOR EACH ROW EXECUTE FUNCTION sync_comment_reaction_counts();

-- ─── RLS ─────────────────────────────────────────────────────
ALTER TABLE public.comment_reactions ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read reactions
CREATE POLICY "reactions_select" ON public.comment_reactions
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Users can insert their own reactions
CREATE POLICY "reactions_insert" ON public.comment_reactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update (flip) their own reaction
CREATE POLICY "reactions_update" ON public.comment_reactions
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own reaction
CREATE POLICY "reactions_delete" ON public.comment_reactions
  FOR DELETE USING (auth.uid() = user_id);

-- ─── Index for fast per-comment lookups ──────────────────────
CREATE INDEX IF NOT EXISTS idx_comment_reactions_comment_id ON public.comment_reactions(comment_id);
CREATE INDEX IF NOT EXISTS idx_comment_reactions_user_id    ON public.comment_reactions(user_id);
