-- ============================================================
-- Migration 015: Weekly bytes + topic breadth
-- ============================================================
--
-- Why: a monthly digest only gives one reason to come back per cycle, and the
-- board is quiet for most of that. A weekly auto-fetched digest turns Bytes
-- into a standing habit instead of a once-a-month event.
--
-- Two additions:
--   kind/period_start on digests, so weekly and monthly runs coexist and a
--   given week can only be fetched once.
--   domain on bytes, so the selector can spread stories across areas instead
--   of returning five AI headlines in a row.

-- ─── Weekly cadence ──────────────────────────────────────────
ALTER TABLE public.byte_digests
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'weekly'
    CHECK (kind IN ('weekly', 'monthly')),
  -- Monday of the covered week (UTC). Null for hand-made digests.
  ADD COLUMN IF NOT EXISTS period_start date;

-- Existing digests predate the weekly job.
UPDATE public.byte_digests SET kind = 'monthly' WHERE period_start IS NULL;

-- One automatic digest per week. Hand-made digests (period_start null) are
-- unaffected, so an admin can still generate an extra one any time.
CREATE UNIQUE INDEX IF NOT EXISTS uniq_byte_digest_period
  ON public.byte_digests (kind, period_start)
  WHERE period_start IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_byte_digests_recent
  ON public.byte_digests (published_at DESC NULLS LAST)
  WHERE status = 'published';

-- ─── New source ──────────────────────────────────────────────
-- Lobsters skews systems/languages where HN skews product news, so adding it
-- widens coverage rather than duplicating it.
ALTER TABLE public.bytes DROP CONSTRAINT IF EXISTS bytes_source_check;
ALTER TABLE public.bytes
  ADD CONSTRAINT bytes_source_check
  CHECK (source IN ('hn', 'devto', 'github', 'lobsters'));

-- ─── Topic breadth ───────────────────────────────────────────
-- Classified from the title at fetch time; see lib/bytes/domains.ts. Nullable
-- because rows created before this migration have no classification.
ALTER TABLE public.bytes
  ADD COLUMN IF NOT EXISTS domain text;

CREATE INDEX IF NOT EXISTS idx_bytes_domain ON public.bytes (domain);

-- Ranking reads interest_count across recent digests, so index the join path.
CREATE INDEX IF NOT EXISTS idx_bytes_interest
  ON public.bytes (interest_count DESC);
