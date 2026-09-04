-- 022  Remove the extractor's columns
--
-- DESTRUCTIVE, and separate from 021 for that reason. 021 makes the app work;
-- this only tidies up, and can wait as long as you like.
--
-- Drops the four columns 020 added for the r.jina.ai extractor, which 021
-- retired. At the time of writing, six rows hold a `content_md` body it
-- fetched; those bodies are deleted by this migration. Nothing reads them -
-- the reader renders content_html - and they are text the publisher did not
-- syndicate, which is the whole reason the extractor was dropped.
--
-- Do not run this until 021 is applied and a digest has generated successfully
-- against it. Rolling back to the previous deployment is impossible afterwards,
-- because that code selects content_md.

ALTER TABLE public.bytes DROP COLUMN IF EXISTS content_md;
ALTER TABLE public.bytes DROP COLUMN IF EXISTS content_source;
ALTER TABLE public.bytes DROP COLUMN IF EXISTS content_fetched_at;
ALTER TABLE public.bytes DROP COLUMN IF EXISTS content_failed_at;

-- Verification
--   \d public.bytes
--   -- expect content_html and reading_minutes, and none of the four above
