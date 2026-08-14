-- 019  Every-other-day digests
--
-- Bytes ran weekly, which meant the page was worth opening on a Monday and
-- stale by Wednesday. The cron now runs every other morning with a smaller
-- digest (6 items instead of 10), so there is a reason to come back mid-week.
--
-- Measured against the live feeds before committing to the cadence: a two-day
-- window returns ~57 candidates from ~34 publishers, which is enough for the
-- medium mix to have real choice. A one-day window returns only two videos.
--
-- 'weekly' and 'monthly' stay permitted: every digest already published is one
-- of those, and narrowing the constraint would reject them on any future
-- UPDATE. The admin's manual button still creates 'monthly'.

ALTER TABLE public.byte_digests DROP CONSTRAINT IF EXISTS byte_digests_kind_check;

ALTER TABLE public.byte_digests
  ADD CONSTRAINT byte_digests_kind_check
  CHECK (kind IN ('daily', 'weekly', 'monthly'));

-- The unique index on (kind, period_start) from 015 needs no change: a daily
-- digest uses the date itself as its period, so a duplicate cron firing on the
-- same morning still collides and is rejected exactly as a duplicate week was.

-- Verification
--   SELECT kind, period_start, label FROM public.byte_digests ORDER BY published_at DESC LIMIT 5;
--   INSERT ... kind = 'daily'  should now succeed.
