-- ============================================================
-- Migration 040: Show & Tell, Radar, nudges, teams, Kers' briefings
-- ============================================================
--
-- Everything the meeting format and the admin dashboard need. All of it is
-- read and written through the API with the service role (no member grants):
-- the API decides what each person may see.
--
-- 1. demos: the Show & Tell queue. Two kinds:
--      spotlight  an admin invites someone (an honour, not an assignment):
--                 invited -> confirmed | passed. Two passes a year; after that
--                 they are offered smaller formats, never forced.
--      demo       anyone volunteers: proposed -> confirmed (by an admin).
--    cycle_id is the meeting it is booked for; NULL means "in the queue, no
--    month yet". done / cancelled close it out.
--
-- 2. radar_links + radar_votes: links members put forward for the meeting's
--    five-minute Radar, beside that month's Bytes. Titles are typed by the
--    member; GuildBoard never fetches the page.
--
-- 3. nudges: a short note from an admin to one person, drafted by Kers from
--    the person's own data and edited by the admin. Channels: push, an inbox
--    card on their board, or a Slack draft the admin copies (people without an
--    account). One per person per 14 days and never to someone with
--    users.nudges_off; both enforced by the API.
--
-- 4. teams: admin-made teams, each with an optional lead. A lead sees their
--    team's totals on /admin, never per-person rows.
--
-- 5. kers_briefings: Kers' daily read of the numbers, cached so the AI is
--    asked once a day (plus a few refreshes) rather than on every page load.

-- ─── 1. Show & Tell ───

CREATE TABLE public.demos (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id     uuid        REFERENCES public.cycles(id) ON DELETE SET NULL,
  user_id      uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kind         text        NOT NULL CHECK (kind IN ('spotlight', 'demo')),
  status       text        NOT NULL CHECK (status IN ('invited', 'proposed', 'confirmed', 'passed', 'done', 'cancelled')),
  format       text        NOT NULL DEFAULT 'demo' CHECK (format IN ('demo', 'talk', 'lightning', 'pair', 'recorded')),
  title        text        CHECK (char_length(title) <= 100),
  blurb        text        CHECK (char_length(blurb) <= 280),
  -- Why they were invited, in the admin's words; shown on the invitation.
  note         text        CHECK (char_length(note) <= 280),
  invited_by   uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  responded_at timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_demos_cycle ON public.demos (cycle_id, kind, status);
CREATE INDEX idx_demos_user ON public.demos (user_id, kind, status);

ALTER TABLE public.demos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.demos FROM anon, authenticated;

-- ─── 2. Radar ───

CREATE TABLE public.radar_links (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id   uuid        NOT NULL REFERENCES public.cycles(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  url        text        NOT NULL CHECK (url ~ '^https://' AND char_length(url) <= 500),
  title      text        NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  note       text        CHECK (char_length(note) <= 160),
  vote_count integer     NOT NULL DEFAULT 0,
  is_deleted boolean     NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cycle_id, url)
);

CREATE INDEX idx_radar_links_cycle ON public.radar_links (cycle_id, vote_count DESC) WHERE NOT is_deleted;

CREATE TABLE public.radar_votes (
  link_id    uuid        NOT NULL REFERENCES public.radar_links(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (link_id, user_id)
);

ALTER TABLE public.radar_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.radar_votes ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.radar_links FROM anon, authenticated;
REVOKE ALL ON public.radar_votes FROM anon, authenticated;

-- Keeps radar_links.vote_count in step with radar_votes.
CREATE OR REPLACE FUNCTION public.radar_vote_count() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.radar_links SET vote_count = vote_count + 1 WHERE id = NEW.link_id;
  ELSE
    UPDATE public.radar_links SET vote_count = greatest(vote_count - 1, 0) WHERE id = OLD.link_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER radar_votes_count
  AFTER INSERT OR DELETE ON public.radar_votes
  FOR EACH ROW EXECUTE FUNCTION public.radar_vote_count();

-- ─── 3. Nudges ───

CREATE TABLE public.nudges (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL for someone without an account (survey answerers, invitees).
  user_id    uuid        REFERENCES public.users(id) ON DELETE CASCADE,
  email      text        NOT NULL CHECK (email = lower(email)),
  channel    text        NOT NULL CHECK (channel IN ('push', 'inbox', 'slack_copy')),
  body       text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 500),
  -- Which group it went out to, when sent in bulk ("survey, no account").
  segment    text        CHECK (char_length(segment) <= 60),
  sent_by    uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  sent_at    timestamptz NOT NULL DEFAULT now(),
  -- The inbox card was closed (read) by its recipient.
  seen_at    timestamptz
);

CREATE INDEX idx_nudges_email ON public.nudges (email, sent_at DESC);
CREATE INDEX idx_nudges_inbox ON public.nudges (user_id) WHERE channel = 'inbox' AND seen_at IS NULL;

ALTER TABLE public.nudges ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.nudges FROM anon, authenticated;

-- ─── 4. Teams ───

CREATE TABLE public.teams (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text        NOT NULL UNIQUE CHECK (char_length(name) BETWEEN 1 AND 60),
  lead_id    uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.teams FROM anon, authenticated;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL;

-- ─── 5. Kers' briefings ───

CREATE TABLE public.kers_briefings (
  key        text        PRIMARY KEY CHECK (char_length(key) <= 80),  -- e.g. 'pulse:2026-11-03'
  body       text        NOT NULL CHECK (char_length(body) <= 1200),
  by_ai      boolean     NOT NULL DEFAULT false,
  refreshes  integer     NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.kers_briefings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.kers_briefings FROM anon, authenticated;
