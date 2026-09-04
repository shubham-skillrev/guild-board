-- 020  Read it here, when the publisher already said we could
--
-- Every byte was a link out. Tapping one left the app, landed on a page with a
-- cookie banner and a newsletter modal, and the member did not come back to
-- upvote it - which is the one action the digest exists to collect.
--
-- ── Why only some rows get a page ────────────────────────────────────────
-- Roughly half the feeds ship the whole article inside the feed itself, in
-- <content:encoded>. Measured, not assumed - of the 22 feeds in sources.ts:
--
--   Full body      Cloudflare, Netflix, GitHub, Meta, Airbnb, Slack,
--                  Pinterest, Sentry, Fly.io, AWS Architecture, Grafana,
--                  IEEE Spectrum
--   Headline only  Stripe, Shopify, Datadog, Spotify, Canva, Google Research,
--                  Simon Willison, Pragmatic Engineer, Ars Technica, InfoQ
--
-- A feed element carrying the full text is the publisher syndicating it on
-- purpose, so those rows are rendered here. Everything else keeps its outbound
-- link and goes to the publisher, which is where a truncated feed is asking
-- readers to go. No scraping, no extraction service, and nothing republished
-- that was not handed to us in a syndication format.
--
-- The body is written during generation, from the same parse that already
-- produced the title and URL, so it costs one extra column write and no extra
-- HTTP request.

ALTER TABLE public.bytes
  ADD COLUMN IF NOT EXISTS content_html text;

COMMENT ON COLUMN public.bytes.content_html IS
  'Article body, verbatim from the feed''s content:encoded (or Atom content). '
  'Publisher HTML, never LLM-authored and never scraped. NULL means the feed '
  'was headline-only and the row links out instead. Sanitized on read, not on '
  'write - see api/bytes/[id].';

-- Doubles as the "is there a page for this row" flag. The alternative was for
-- the digest list to select content_html and check it for NULL, which would
-- ship a quarter of a megabyte of article bodies to render ten link rows.
ALTER TABLE public.bytes
  ADD COLUMN IF NOT EXISTS reading_minutes smallint
  CHECK (reading_minutes IS NULL OR reading_minutes BETWEEN 1 AND 120);

COMMENT ON COLUMN public.bytes.reading_minutes IS
  'Estimated read time. Non-NULL exactly when content_html is, so the list can '
  'decide whether a row links inward or outward without fetching any bodies.';

-- Verification
--   \d public.bytes
--   SELECT source_name, reading_minutes, length(content_html)
--     FROM public.bytes WHERE content_html IS NOT NULL ORDER BY created_at DESC;
--   -- expect rows from Cloudflare/Netflix/GitHub and none from Ars/InfoQ/HN
