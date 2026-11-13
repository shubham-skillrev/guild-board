-- ============================================================
-- Migration 050: The Boss Round's stages
-- ============================================================
--
-- Meeting mode v2, Batch 4 (docs/08-meeting-mode-v2.md): the Boss Round is
-- three activity slides, each its own meeting_activities row with its own
-- countdown and reveal (src/lib/meet/bossStages.ts):
--
--   predict  "Predict the output": code and 2-4 answer tiles (options), the
--            right tile in config.answer. One locked answer, slot 0 { option }
--   fill     "Fill the blank": code with one or two ___ gaps, the right token
--            per gap (config.answers) and decoy chips (config.decoys). One
--            locked answer, slot 0 { tokens }
--   boss     "Write it": unchanged (046's Boss Round). Slot 0 is still the
--            latest run; slot 1 now holds a watching phone's cheers ({ n },
--            rate-limited by the server) and slot 2 a laptop's "started
--            typing" ({ started }), for the screen's "N coding". Both fit
--            046's slots 0-2.
--
-- The right answers stay in config on the server: phones and the shared
-- screen get the stage's code, tiles and chips only, and the answer once the
-- stage has closed. Graded on the server from what was tapped.
--
-- Only the kind check changes. Until it's applied the slide editor saves the
-- stage slides into the agenda but can't write their predict / fill rows
-- (it says this migration is missing); polls, clouds and the write stage
-- work as before. Service role only, like the rest of meeting_activities.

ALTER TABLE public.meeting_activities DROP CONSTRAINT IF EXISTS meeting_activities_kind_check;
ALTER TABLE public.meeting_activities
  ADD CONSTRAINT meeting_activities_kind_check CHECK (kind IN ('poll', 'cloud', 'boss', 'predict', 'fill'));
