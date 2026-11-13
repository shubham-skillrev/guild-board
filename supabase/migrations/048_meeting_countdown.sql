-- ============================================================
-- Migration 048: Meeting mode's countdown ring
-- ============================================================
--
-- Meeting mode v2, Batch 2 (docs/08-meeting-mode-v2.md): every activity runs
-- for a set time, shown as a ring on the shared screen and every phone, then
-- closes on its own.
--
--   closes_at  when the open activity closes. Set when it opens: opened_at
--              plus its slide's `duration_s` in meetings.agenda (default
--              130 s for a poll or word cloud, 300 s for the Boss Round;
--              src/lib/meet/timer.ts). The presenter's "+30s" moves it on.
--              Once it has passed, the server closes the activity on the
--              next read of the room (src/lib/meet/room.ts closeDue), and
--              refuses answers that arrive after it (a second's grace).
--              Null: untimed (an activity opened before this migration).
--
-- The server is the source of truth: clients only draw the ring from it,
-- corrected by their clock's offset from the server's.
--
-- Additive and nullable: until it's applied, activities open untimed and
-- close only by hand, and the presenter screen says this migration is
-- missing. Service role only, like the rest of meeting_activities (046).

ALTER TABLE public.meeting_activities
  ADD COLUMN IF NOT EXISTS closes_at timestamptz;
