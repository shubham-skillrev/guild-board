-- ============================================================
-- Migration 047: Meeting mode's live rehearsal
-- ============================================================
--
-- The day before the meeting, an admin rehearses the real flow end to end:
-- their laptop as the shared screen, their phone and a few people's on
-- /meet, the real join, answers, broadcast and slides opening and closing
-- their activities (docs/06-meeting-mode.md, "Rehearsal";
-- src/lib/meet/liveRehearsal.ts).
--
--   rehearsal_code        a random, unguessable code (base64url, 32 chars):
--                         /meet lets in only those holding it (the share
--                         link /meet?r=<code>, kept in an httpOnly cookie).
--                         Null when no rehearsal is running.
--   rehearsal_started_at  when it started; one left running stops counting
--                         after 8 h, like a live meeting.
--
-- A rehearsal never sets started_at or ended_at: the meeting is not live
-- (no banner, /api/meet/live says no) and meetingDone() is untouched.
-- Ending it (or starting the real meeting) deletes the month's
-- meeting_participants (answers cascade), resets every meeting_activities
-- row to 'ready', clears presenter_id / current_segment and this code.
--
-- Additive and nullable. Service role only, like the rest of `meetings` (041):
-- the code is never readable from the browser except by admins through
-- /api/admin/meeting.

ALTER TABLE public.meetings
  ADD COLUMN IF NOT EXISTS rehearsal_code       text CHECK (rehearsal_code IS NULL OR rehearsal_code ~ '^[A-Za-z0-9_-]{20,64}$'),
  ADD COLUMN IF NOT EXISTS rehearsal_started_at timestamptz;
