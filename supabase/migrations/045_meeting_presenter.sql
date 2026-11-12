-- ============================================================
-- Migration 045: Meeting mode's presenter
-- ============================================================
--
-- Phase 1 of meeting mode (docs/06-meeting-mode.md): one admin presents the
-- meeting on a shared screen (/meet/present); every other admin who opens it
-- gets it read-only, with "Take over".
--
--   presenter_id        the admin who started (or took over) meeting mode.
--                       Only they move segments.
--   current_segment     the agenda segment on screen (an id from `agenda`)
--   segment_started_at  when that segment started, for its countdown. A
--                       refresh of the presenter screen resumes from these.
--
-- Kers' prep needs no column: it lives on each agenda item, inside the
-- existing `agenda` jsonb, as
--   prep: { points: string[], opener: string, ask: uuid[], by, at }
-- `ask` ("who to ask": members who voted or commented on the segment's
-- topic) is stored only. The API strips it before anything leaves the server.
--
-- Service role only, like the rest of `meetings` (041).

ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS presenter_id       uuid REFERENCES public.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS current_segment    text CHECK (current_segment IS NULL OR char_length(current_segment) <= 40),
  ADD COLUMN IF NOT EXISTS segment_started_at timestamptz;
