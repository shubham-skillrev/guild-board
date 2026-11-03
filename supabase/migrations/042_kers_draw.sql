-- ============================================================
-- Migration 042: Kers' draw for Show & Tell
-- ============================================================
--
-- Each month Kers draws who's invited to the Spotlight (and the Demo, when
-- nobody volunteered): one draw per slot, each an ordered list of picks.
-- The first pick is invited; the rest wait quietly as reserves. A pass, or
-- three days without an answer, moves the next one up. A slot whose picks
-- all fall through gets one redraw (round 2), then goes to an admin.
--
--   draws.status
--     review    drawn, invitations not sent yet: admins can swap picks until
--               review_until (24 hours), then the daily cron sends them
--     inviting  someone is invited and has 3 days to answer
--     filled    someone said yes
--     failed    round 2 ran out too: an admin invites someone directly
--     cancelled an admin invited someone directly instead
--
--   draw_picks.state
--     waiting   a reserve, never told anything
--     invited   has the invitation (demo_id points at it)
--     accepted / passed / expired
--     swapped   replaced by an admin during review, never told
--
-- Nobody but admins ever sees who was drawn or who passed. Service role only.

CREATE TABLE public.draws (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id     uuid        NOT NULL REFERENCES public.cycles(id) ON DELETE CASCADE,
  kind         text        NOT NULL CHECK (kind IN ('spotlight', 'demo')),
  round        smallint    NOT NULL DEFAULT 1 CHECK (round IN (1, 2)),
  status       text        NOT NULL CHECK (status IN ('review', 'inviting', 'filled', 'failed', 'cancelled')),
  review_until timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cycle_id, kind, round)
);

CREATE TABLE public.draw_picks (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  draw_id    uuid        NOT NULL REFERENCES public.draws(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  position   smallint    NOT NULL,
  tickets    smallint    NOT NULL DEFAULT 1,
  state      text        NOT NULL CHECK (state IN ('waiting', 'invited', 'accepted', 'passed', 'expired', 'swapped')),
  demo_id    uuid        REFERENCES public.demos(id) ON DELETE SET NULL,
  invited_at timestamptz,
  UNIQUE (draw_id, position)
);

CREATE INDEX idx_draw_picks_demo ON public.draw_picks (demo_id) WHERE demo_id IS NOT NULL;

ALTER TABLE public.draws ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.draw_picks ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.draws FROM anon, authenticated;
REVOKE ALL ON public.draw_picks FROM anon, authenticated;
