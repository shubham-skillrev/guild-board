-- 018  A mixed digest: articles, news and video
--
-- GitHub repositories are retired as a source. A row whose entire content was
-- `owner/repo` and a star count gave a reader nothing to act on: no argument,
-- no explanation, and nothing to discuss at a meeting. Two sources replace it,
-- both of which arrive with a piece of writing or a talk attached:
--
--   'news'   tech journalism that reads like an article (Ars Technica, InfoQ,
--            IEEE Spectrum), not a headline wire.
--   'video'  conference talks and explainers, pulled from YouTube channel
--            feeds. Keyless, same RSS path as every other source.
--
-- 'github' stays permitted by the CHECK for the same reason 'lobsters' and
-- 'devto' did in 016: rows written by earlier runs are still in the table, and
-- narrowing the constraint would reject them on any future UPDATE.

ALTER TABLE public.bytes DROP CONSTRAINT IF EXISTS bytes_source_check;

ALTER TABLE public.bytes
  ADD CONSTRAINT bytes_source_check
  CHECK (source IN ('hn', 'devto', 'github', 'lobsters', 'blog', 'news', 'video'));

-- ─── Publisher, as its own column ────────────────────────────────────────
-- The generator used to prefix the publisher onto the headline
-- ("Cloudflare: How we ..."), which put provenance inside the one string that
-- is contractually verbatim from the feed. It now lands here instead, so the
-- headline is exactly what the publisher wrote and the UI can style the source
-- separately from the title.
ALTER TABLE public.bytes
  ADD COLUMN IF NOT EXISTS source_name text
  CHECK (source_name IS NULL OR char_length(source_name) <= 80);

COMMENT ON COLUMN public.bytes.source_name IS
  'Publisher or channel the item came from, e.g. Cloudflare, Ars Technica, Fireship. Verbatim from the feed title.';

-- ─── Thumbnail, for video rows ───────────────────────────────────────────
-- A video row without a still frame is indistinguishable from a link, and the
-- whole point of carrying video is that it reads as something to watch.
ALTER TABLE public.bytes
  ADD COLUMN IF NOT EXISTS thumbnail_url text
  CHECK (thumbnail_url IS NULL OR thumbnail_url ~ '^https://');

COMMENT ON COLUMN public.bytes.thumbnail_url IS
  'Still frame for video items. https only; written verbatim from the feed.';

-- ─── Backfill the publisher off existing blog rows ───────────────────────
-- Only rows the old generator prefixed itself: source = 'blog' and a short
-- leading token before ": ". The length bound keeps a real headline containing
-- a colon ("Postgres 17: what changed") from being split at the wrong place -
-- worst case a row keeps its old title and shows no publisher chip, which is
-- what an un-backfilled row does anyway.
UPDATE public.bytes
SET
  source_name  = split_part(source_title, ': ', 1),
  source_title = substr(source_title, strpos(source_title, ': ') + 2)
WHERE source = 'blog'
  AND source_name IS NULL
  AND source_title ~ '^[A-Za-z][A-Za-z0-9 .&-]{1,18}: .';

-- Verification
--   SELECT source, count(*) FROM public.bytes GROUP BY source;
--   SELECT source_name, source_title FROM public.bytes WHERE source = 'blog' LIMIT 10;
--   INSERT ... source = 'video'  should now succeed.
