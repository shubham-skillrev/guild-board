-- ============================================================
-- Migration 039: Byte briefs instead of republished articles
-- ============================================================
--
-- A byte page used to show the publisher's whole article when their feed
-- syndicated it. GuildBoard has no licence to republish anyone's writing, and
-- a feed's HTML rarely looks right inside the app, so a byte is now a brief:
--
--   summary    AI-drafted, 3-4 sentences (cap raised from 400 to 700)
--   actions    AI-suggested "try this": up to 3 short lines, plain text, no
--              links (the model still never writes a URL)
--   resources  real links taken from the publisher's own feed item (repos,
--              docs, papers), [{ "title": "...", "url": "https://..." }],
--              extracted by code, never by the model
--   brief_at   when the brief was made; NULL marks an older row the daily
--              cron still has to convert
--
-- content_html is no longer written. The cron clears it on older rows as it
-- converts them (after pulling their links out), so no article body stays
-- stored. The column itself stays until every row has been converted.

ALTER TABLE public.bytes
  ADD COLUMN IF NOT EXISTS actions   text[] CHECK (actions IS NULL OR cardinality(actions) <= 3),
  ADD COLUMN IF NOT EXISTS resources jsonb  NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(resources) = 'array'),
  ADD COLUMN IF NOT EXISTS brief_at  timestamptz;

ALTER TABLE public.bytes DROP CONSTRAINT IF EXISTS bytes_summary_check;
ALTER TABLE public.bytes
  ADD CONSTRAINT bytes_summary_check CHECK (summary IS NULL OR char_length(summary) <= 700);

CREATE INDEX IF NOT EXISTS idx_bytes_brief_pending ON public.bytes (created_at DESC) WHERE brief_at IS NULL;
