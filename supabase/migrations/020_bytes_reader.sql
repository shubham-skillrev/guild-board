-- 020  Read it here: article bodies, and a monthly top-of-month digest
--
-- Two changes that share a table.
--
-- ── The reader ───────────────────────────────────────────────────────────
-- Every byte was a link out. Tapping one left the app, landed on a page with
-- a cookie banner and a newsletter modal, and the member did not come back to
-- upvote it - which is the one action the digest exists to collect. The body
-- now lands here, so reading and upvoting happen on the same screen.
--
-- Bodies are fetched lazily, on first open, not during generation: a digest of
-- six items is read for two, and pulling six full articles inside the cron
-- would quadruple its runtime to cache four bodies nobody asks for. The
-- columns below are therefore a cache, and NULL means "not opened yet", never
-- "failed".
--
-- The extraction contract matches the one in 014: `content_md` is transcribed
-- from the publisher's own page and is never model-authored. The reader renders
-- it under the publisher's name with a link to the original, which is the
-- attribution the copy is shown under.

ALTER TABLE public.bytes
  ADD COLUMN IF NOT EXISTS content_md text;

COMMENT ON COLUMN public.bytes.content_md IS
  'Article body as markdown, transcribed from the publisher page. Lazily cached on first read. Never LLM-authored.';

-- Which path produced the body, so a bad extractor can be found and re-run
-- without guessing. 'reader' is r.jina.ai; 'feed' is a full content:encoded
-- block that arrived with the RSS item.
ALTER TABLE public.bytes
  ADD COLUMN IF NOT EXISTS content_source text
  CHECK (content_source IS NULL OR content_source IN ('feed', 'reader'));

ALTER TABLE public.bytes
  ADD COLUMN IF NOT EXISTS content_fetched_at timestamptz;

-- Written at fetch time rather than computed per render. It is shown before
-- the body loads, and counting words in the client to display "8 min" is work
-- done once per reader instead of once per article.
ALTER TABLE public.bytes
  ADD COLUMN IF NOT EXISTS reading_minutes smallint
  CHECK (reading_minutes IS NULL OR reading_minutes BETWEEN 1 AND 120);

-- A body that could not be extracted must not be retried on every single page
-- view: a paywalled article fails identically every time, and a member
-- refreshing the page would hammer the extractor for a result that will not
-- change. A failed attempt records its time here and is retried at most daily.
ALTER TABLE public.bytes
  ADD COLUMN IF NOT EXISTS content_failed_at timestamptz;

-- ── Top of the month ─────────────────────────────────────────────────────
-- The every-other-day drop is deliberately small and deliberately recent, so a
-- story that mattered in week one is gone by week three. A monthly pass over a
-- 31-day window brings the month's strongest items back into one place.
--
-- The kind already validates: 'monthly' has been permitted since 015. What
-- changes is that a monthly digest now carries a period_start (the 1st of the
-- month), so the unique index on (kind, period_start) makes a duplicate cron
-- firing a no-op. Existing monthly rows have period_start NULL and do not
-- collide, because NULL is distinct from every other value in a unique index -
-- the admin's manual button keeps working exactly as it does today.

-- Verification
--   \d public.bytes
--   SELECT id, content_source, reading_minutes FROM public.bytes WHERE content_md IS NOT NULL;
--   SELECT kind, period_start, label FROM public.byte_digests ORDER BY published_at DESC LIMIT 5;
