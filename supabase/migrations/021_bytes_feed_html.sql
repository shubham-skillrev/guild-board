-- 021  The body comes from the feed, not from an extractor
--
-- 020 cached article bodies pulled through r.jina.ai into `content_md`. That
-- worked, and it is applied - six rows in the live table hold text it fetched.
-- It is being retired anyway, because it went and got text publishers had
-- chosen not to hand over, and then rendered it on our own page.
--
-- Bodies now come from the feed and nowhere else. Roughly half the feeds ship
-- the whole article in <content:encoded> (or Atom <content>, or a <description>
-- long enough to be a body rather than a teaser), and a feed element carrying
-- the full text is the publisher syndicating it deliberately. The rest keep
-- their outbound link, which is what a truncated feed is asking for.
--
-- Measured across the 22 feeds in sources.ts:
--
--   Full body      Cloudflare, Netflix, GitHub, Meta, Airbnb, Slack,
--                  Pinterest, Sentry, Fly.io, AWS Architecture, Grafana,
--                  IEEE Spectrum
--   Headline only  Stripe, Shopify, Datadog, Spotify, Canva, Google Research,
--                  Simon Willison, Pragmatic Engineer, Ars Technica, InfoQ
--
-- This migration is additive. It adds nothing but a column, and drops nothing,
-- so applying it cannot break the deployment currently running. The four
-- columns 020 added for the extractor are left in place and are retired rather
-- than removed - see 022 for the cleanup, which is deliberately separate
-- because it destroys the six cached bodies.

ALTER TABLE public.bytes
  ADD COLUMN IF NOT EXISTS content_html text;

COMMENT ON COLUMN public.bytes.content_html IS
  'Article body, verbatim from the feed''s content:encoded (or Atom content, or '
  'a full-length description). Publisher HTML, never LLM-authored and never '
  'scraped. NULL means the feed was headline-only and the row links out. '
  'Sanitized on read, not on write - see lib/bytes/articleHtml.ts.';

-- reading_minutes already exists, from 020. It keeps its meaning and gains a
-- job: it is non-NULL exactly when a body was written, so the digest list uses
-- it as the "does this row open in the app" flag. Selecting content_html to
-- test it for NULL would ship a quarter of a megabyte of article bodies to
-- render ten link rows.
COMMENT ON COLUMN public.bytes.reading_minutes IS
  'Estimated read time. Non-NULL exactly when content_html is, so the digest '
  'list can decide inward or outward links without fetching any bodies.';

-- The extractor's columns, marked so nobody wires them back up by accident.
COMMENT ON COLUMN public.bytes.content_md IS
  'RETIRED. Bodies extracted via r.jina.ai before 021. Read by nothing. See 022.';
COMMENT ON COLUMN public.bytes.content_source IS 'RETIRED with content_md. See 022.';
COMMENT ON COLUMN public.bytes.content_fetched_at IS 'RETIRED with content_md. See 022.';
COMMENT ON COLUMN public.bytes.content_failed_at IS 'RETIRED with content_md. See 022.';

-- Verification
--   SELECT source_name, reading_minutes, length(content_html)
--     FROM public.bytes WHERE content_html IS NOT NULL ORDER BY created_at DESC;
--   -- after the next digest: rows from Cloudflare/Netflix/GitHub, none from
--   -- Ars/InfoQ/HN, and none of them NULL in reading_minutes
