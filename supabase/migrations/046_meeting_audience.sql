-- ============================================================
-- Migration 046: Meeting mode's audience
-- ============================================================
--
-- Phase 2 of meeting mode (docs/06-meeting-mode.md): everyone in the call
-- joins /meet on a laptop or phone and answers the segment's activity (an
-- opinion poll or a word cloud; the Boss Round in Phase 3). The shared
-- screen shows only counts and words, never names.
--
--   meeting_participants  who joined this month's meeting: a member (user_id)
--                         or a guest (a typed name plus the SHA-256 of the
--                         random token in their httpOnly cookie; the token
--                         itself is never stored). Guest token hashes are
--                         cleared when the meeting ends, so the cookie dies
--                         with it. Names are stored, never shown.
--   meeting_activities    one per agenda segment (segment_id = an id from
--                         meetings.agenda): kind poll / cloud / boss, the
--                         prompt, poll options (2-4), config (the Boss
--                         Round's problem, Phase 3), status ready -> open ->
--                         closed. Seeded by scripts/seed-meeting-activities.mjs.
--   meeting_responses     one row per answer: a poll vote (slot 0, so one
--                         per participant, changed in place) or one word of
--                         a word cloud (slots 0-2, so at most three).
--                         `value` is jsonb: { option } / { word } / Phase 3's
--                         { passed, tests, of }.
--
-- Live updates: the server sends the room's aggregate (counts and words,
-- nothing that names anyone) on the private broadcast channel
-- `meeting:{cycle_id}`, at most once a second per meeting. `meetings` gains
-- the throttle's two timestamps, claimed atomically by meeting_live_claim().
--
-- All three tables are service role only, like `meetings` (041): every
-- read and write goes through /api/meet and /api/admin/meeting.

CREATE TABLE public.meeting_participants (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id         uuid        NOT NULL REFERENCES public.meetings(cycle_id) ON DELETE CASCADE,
  user_id          uuid        REFERENCES public.users(id) ON DELETE CASCADE,
  guest_name       text        CHECK (guest_name IS NULL OR char_length(guest_name) BETWEEN 1 AND 40),
  guest_token_hash text        UNIQUE CHECK (guest_token_hash IS NULL OR guest_token_hash ~ '^[0-9a-f]{64}$'),
  joined_at        timestamptz NOT NULL DEFAULT now(),
  -- A member or a guest, never both.
  CHECK ((user_id IS NULL) <> (guest_name IS NULL)),
  UNIQUE (cycle_id, user_id)
);
CREATE INDEX meeting_participants_cycle ON public.meeting_participants (cycle_id);

CREATE TABLE public.meeting_activities (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id    uuid        NOT NULL REFERENCES public.meetings(cycle_id) ON DELETE CASCADE,
  segment_id  text        NOT NULL CHECK (char_length(segment_id) BETWEEN 1 AND 40),
  kind        text        NOT NULL CHECK (kind IN ('poll', 'cloud', 'boss')),
  prompt      text        NOT NULL CHECK (char_length(prompt) BETWEEN 1 AND 200),
  options     jsonb       NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(options) = 'array'),
  config      jsonb       NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(config) = 'object'),
  status      text        NOT NULL DEFAULT 'ready' CHECK (status IN ('ready', 'open', 'closed')),
  opened_at   timestamptz,
  closed_at   timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (kind <> 'poll' OR jsonb_array_length(options) BETWEEN 2 AND 4),
  -- One activity per segment: the presenter's one "Open" button.
  UNIQUE (cycle_id, segment_id)
);
-- At most one open activity per meeting.
CREATE UNIQUE INDEX meeting_activities_one_open ON public.meeting_activities (cycle_id) WHERE status = 'open';

CREATE TABLE public.meeting_responses (
  id             bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  activity_id    uuid        NOT NULL REFERENCES public.meeting_activities(id) ON DELETE CASCADE,
  participant_id uuid        NOT NULL REFERENCES public.meeting_participants(id) ON DELETE CASCADE,
  slot           smallint    NOT NULL DEFAULT 0 CHECK (slot BETWEEN 0 AND 2),
  value          jsonb       NOT NULL CHECK (jsonb_typeof(value) = 'object'),
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  -- Polls only ever use slot 0: one vote per participant, changed in place.
  UNIQUE (activity_id, participant_id, slot)
);
CREATE INDEX meeting_responses_activity ON public.meeting_responses (activity_id);

ALTER TABLE public.meeting_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_activities   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_responses    ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.meeting_participants, public.meeting_activities, public.meeting_responses FROM anon, authenticated;

-- ─── The broadcast throttle ───────────────────────────────────
--
-- Every answer asks for a broadcast; at most one per meeting per p_gap_ms
-- goes out. Called (service role) after each write:
--
--   0    send now (live_sent_at is set to now)
--   > 0  you own the trailing flush: wait this many ms, then call again
--   -1   nothing to do: a send went out just now and a flush is already
--        waiting, so it will carry this answer too
--
-- A flush whose function died is replaced once it's a gap past due.
ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS live_sent_at  timestamptz,
  ADD COLUMN IF NOT EXISTS live_flush_at timestamptz;

CREATE OR REPLACE FUNCTION public.meeting_live_claim(p_cycle uuid, p_gap_ms integer DEFAULT 1000)
RETURNS integer
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  m   record;
  gap interval := make_interval(secs => p_gap_ms / 1000.0);
  t   timestamptz := clock_timestamp();
BEGIN
  SELECT live_sent_at, live_flush_at INTO m FROM public.meetings WHERE cycle_id = p_cycle FOR UPDATE;
  IF NOT FOUND THEN
    RETURN -1;
  END IF;
  IF m.live_sent_at IS NULL OR m.live_sent_at <= t - gap THEN
    UPDATE public.meetings SET live_sent_at = t, live_flush_at = NULL WHERE cycle_id = p_cycle;
    RETURN 0;
  END IF;
  IF m.live_flush_at IS NULL OR m.live_flush_at < t - gap THEN
    UPDATE public.meetings SET live_flush_at = m.live_sent_at + gap WHERE cycle_id = p_cycle;
    RETURN GREATEST(1, ceil(extract(epoch FROM (m.live_sent_at + gap - t)) * 1000))::integer;
  END IF;
  RETURN -1;
END;
$$;

REVOKE ALL ON FUNCTION public.meeting_live_claim(uuid, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.meeting_live_claim(uuid, integer) TO service_role;

-- ─── Who may listen ───────────────────────────────────────────
--
-- Extends 030: members (authenticated) and guests (anon: a /meet guest has
-- no Supabase account, so the browser joins with the publishable key) may
-- LISTEN on `meeting:*`. The payload is exactly what the shared screen
-- shows, built by the server: a participant count and the open activity's
-- counts or words, never a name, id or who answered what. Nobody but the
-- service role may send. No presence.
CREATE POLICY "guildboard_meeting_listen" ON realtime.messages
  FOR SELECT
  TO anon, authenticated
  USING (
    realtime.messages.extension = 'broadcast'
    AND realtime.topic() LIKE 'meeting:%'
  );
