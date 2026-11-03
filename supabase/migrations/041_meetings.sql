-- ============================================================
-- Migration 041: The meeting itself
-- ============================================================
--
-- One row per month's meeting, for the Run tab:
--
--   meet_url       the call link, shared in the agenda post
--   agenda         [{ id, kind, title, detail, minutes }], built from the
--                  format (Radar, Show & Tell, top topic, clinic, wrap) and
--                  edited by an organiser
--   notes          [{ id, segment, text, owner, decision, at }], captured live
--                  in meeting mode
--   recording_url  added afterwards, linked in the recap
--   recap          the recap text, drafted by Kers and edited
--   *_posted_at    when the agenda / recap went to Slack
--   started_at / ended_at   meeting mode's clock
--
-- Service role only: the API decides who sees what.

CREATE TABLE public.meetings (
  cycle_id         uuid        PRIMARY KEY REFERENCES public.cycles(id) ON DELETE CASCADE,
  meet_url         text        CHECK (meet_url IS NULL OR (meet_url ~ '^https://' AND char_length(meet_url) <= 500)),
  agenda           jsonb       NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(agenda) = 'array'),
  notes            jsonb       NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(notes) = 'array'),
  recording_url    text        CHECK (recording_url IS NULL OR (recording_url ~ '^https://' AND char_length(recording_url) <= 500)),
  recap            text        CHECK (char_length(recap) <= 4000),
  agenda_posted_at timestamptz,
  recap_posted_at  timestamptz,
  started_at       timestamptz,
  ended_at         timestamptz,
  updated_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.meetings ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.meetings FROM anon, authenticated;
