-- 024  What someone brings: five discussion kinds
--
-- GuildBoard is a place to talk tech, and the share form now starts by asking
-- what kind of thing you are bringing: a problem, something learned, new tech,
-- a take, or something you built. The kind is stored in the existing
-- `category` column, so this widens its CHECK on both tables that carry it.
--
-- The four original values stay valid: past posts keep their category, and
-- scoring still reads `deep_dive` for its bonus.
--
-- The original constraints were declared inline, so their names were chosen
-- by Postgres. Rather than guess the name, drop whatever CHECK currently
-- governs `category` on each table, then add one with a known name.

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT c.conrelid::regclass AS tbl, c.conname
    FROM pg_constraint c
    JOIN pg_attribute a
      ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.contype = 'c'
      AND a.attname = 'category'
      AND c.conrelid IN ('public.topics'::regclass, 'public.idea_bank'::regclass)
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
  END LOOP;
END $$;

ALTER TABLE public.topics
  ADD CONSTRAINT topics_category_check CHECK (category IN (
    'deep_dive', 'discussion', 'blog_idea', 'project_showcase',
    'problem', 'learned', 'new_tech', 'take', 'show_tell'
  ));

-- idea_bank.category is nullable: a banked idea does not have to pick a kind.
ALTER TABLE public.idea_bank
  ADD CONSTRAINT idea_bank_category_check CHECK (category IS NULL OR category IN (
    'deep_dive', 'discussion', 'blog_idea', 'project_showcase',
    'problem', 'learned', 'new_tech', 'take', 'show_tell'
  ));
