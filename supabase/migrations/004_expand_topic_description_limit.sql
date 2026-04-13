-- ============================================================
-- Migration 004: Set topic description limit to 1000 chars
-- ============================================================

DO $$
DECLARE
  con RECORD;
BEGIN
  FOR con IN
    SELECT c.conname
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE n.nspname = 'public'
      AND t.relname = 'topics'
      AND c.contype = 'c'
      AND pg_get_constraintdef(c.oid) ILIKE '%description%'
      AND pg_get_constraintdef(c.oid) ILIKE '%char_length%'
  LOOP
    EXECUTE format('ALTER TABLE public.topics DROP CONSTRAINT %I', con.conname);
  END LOOP;
END $$;

ALTER TABLE public.topics
  ADD CONSTRAINT topic_description_check
  CHECK (char_length(description) <= 1000);
