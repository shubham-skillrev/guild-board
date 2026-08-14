-- 016  Engineering-blog source for Bytes
--
-- The digest previously ranked Hacker News, Lobsters, dev.to and GitHub
-- together. Lobsters and dev.to rank community opinion posts alongside
-- engineering writing, which is why the feed surfaced rants rather than
-- articles. Both are retired in application code; the primary source is now
-- company engineering blogs read from their own RSS/Atom feeds.
--
-- 'lobsters' and 'devto' stay permitted by the CHECK on purpose: rows written
-- by earlier runs are still in the table, and narrowing the constraint would
-- reject them on any future UPDATE.

ALTER TABLE public.bytes DROP CONSTRAINT IF EXISTS bytes_source_check;

ALTER TABLE public.bytes
  ADD CONSTRAINT bytes_source_check
  CHECK (source IN ('hn', 'devto', 'github', 'lobsters', 'blog'));

-- Verification
--   SELECT source, count(*) FROM public.bytes GROUP BY source;
--   INSERT ... source = 'blog'  should now succeed.
