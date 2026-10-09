-- ============================================================
-- Migration 028: Anonymity hardening + column-level lockdown
-- ============================================================
--
-- Why: the ghost-post modal promises "hidden from everyone, admins included",
-- but RLS only filters ROWS. Every column of a readable row was readable, so
-- any signed-in member holding the publishable key could query PostgREST
-- directly and de-anonymise:
--
--   topics.user_id          -> who wrote a ghost topic
--   comments.user_id        -> who wrote a ghost comment / ghost OP replies
--   idea_bank.user_id,
--   idea_bank.promoted_by   -> who banked / promoted a ghost idea
--   topic_asks.asker_id     -> a ghost author inviting people into their topic
--   users.real_name, email  -> real identities behind every username
--
-- The fix is column privileges. RLS stays as it is (it still decides which
-- rows); these grants decide which columns. The app reads the hidden columns
-- only through the service-role client and serializes them away
-- (src/lib/utils/anonymity.ts).
--
-- The same gap existed for writes: "Users can update own username" had no
-- column list, so any member could set their own users.role = 'admin', and a
-- direct topics INSERT could set is_system / is_carry_forward (skipping the
-- 3-per-cycle trigger) or seed vote_count. Writes are narrowed to exactly what
-- the app does with the member's own session.
--
-- Finally, topics is removed from the supabase_realtime publication: raw
-- postgres_changes payloads carry every column, user_id included. The board
-- polls until sanitized broadcast replaces it.
--
-- IMPORTANT for future migrations: a column added to any table below is NOT
-- readable by members until it is granted explicitly, e.g.
--   GRANT SELECT (new_col) ON public.topics TO authenticated;

-- ─── Ghost comments ──────────────────────────────────────────
-- Added before the grants below so it is included in them.
ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS is_anonymous boolean NOT NULL DEFAULT false;

-- ─── Read lockdown: every column except the identifying ones ──
-- Column lists are computed from the live schema so nothing visible today is
-- accidentally dropped.
DO $$
DECLARE
  spec record;
  cols text;
BEGIN
  FOR spec IN
    SELECT * FROM (VALUES
      ('topics',     ARRAY['user_id']),
      ('comments',   ARRAY['user_id']),
      ('idea_bank',  ARRAY['user_id', 'promoted_by']),
      ('topic_asks', ARRAY['asker_id']),
      ('users',      ARRAY['real_name', 'email'])
    ) AS t(tbl, hidden)
  LOOP
    SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
      INTO cols
      FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = spec.tbl
       AND column_name <> ALL (spec.hidden);

    EXECUTE format('REVOKE SELECT ON public.%I FROM anon, authenticated', spec.tbl);
    EXECUTE format('GRANT SELECT (%s) ON public.%I TO authenticated', cols, spec.tbl);
  END LOOP;
END $$;

-- ─── Write lockdown ──────────────────────────────────────────
-- users: members may change their username and nothing else.
REVOKE INSERT, UPDATE, DELETE ON public.users FROM anon, authenticated;
GRANT UPDATE (username) ON public.users TO authenticated;

-- topics: members insert their own post with these fields only (POST
-- /api/topics, /api/idea-bank/promote). Every other write goes through the
-- service role after an ownership check.
REVOKE INSERT, UPDATE, DELETE ON public.topics FROM anon, authenticated;
GRANT INSERT (cycle_id, user_id, title, description, category, is_anonymous)
  ON public.topics TO authenticated;

-- comments: all writes already go through the service role.
REVOKE INSERT, UPDATE, DELETE ON public.comments FROM anon, authenticated;

-- ─── Own topic count for the quota strip ─────────────────────
-- useUserTokens counted rows with .eq('user_id', me), which needs the column
-- this migration hides. Same rule as check_topic_limit() (027).
CREATE OR REPLACE FUNCTION public.my_topic_count(p_cycle_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::integer
    FROM public.topics
   WHERE user_id = auth.uid()
     AND cycle_id = p_cycle_id
     AND is_deleted = FALSE
     AND is_carry_forward = FALSE;
$$;

REVOKE ALL ON FUNCTION public.my_topic_count(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_topic_count(uuid) TO authenticated;

-- ─── Realtime: stop streaming raw topic rows ─────────────────
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_publication_tables
     WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'topics'
  ) THEN
    ALTER PUBLICATION supabase_realtime DROP TABLE public.topics;
  END IF;
END $$;
