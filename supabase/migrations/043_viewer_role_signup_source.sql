-- ============================================================
-- Migration 043: Viewer role, sign-up source, no more teams
-- ============================================================
--
-- 1. users.role gains 'viewer': someone who can see the control room's
--    analytics (Pulse, People, Topics, Survey) read-only, but can't run
--    anything, send nudges, see Kers' draw, or touch the Run tab. Admins
--    toggle it on a person's card in People.
--
-- 2. users.signup_source: where a new member came from, recorded at their
--    first sign-in: 'survey' (signed up from the survey), 'join' (the /join
--    invite page) or 'direct'. NULL for everyone who joined before this.
--
-- 3. Teams (migration 040) go: they only existed to give team leads a
--    team-scoped view, which the viewer role replaces. Nobody was assigned.

ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users
  ADD CONSTRAINT users_role_check CHECK (role IN ('user', 'admin', 'viewer'));

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS signup_source text CHECK (signup_source IN ('survey', 'join', 'direct'));

ALTER TABLE public.users DROP COLUMN IF EXISTS team_id;
DROP TABLE IF EXISTS public.teams;
