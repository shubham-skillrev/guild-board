-- ============================================================
-- Migration 031: GuildBot's memory, and opting in to be teased
-- ============================================================
--
-- guildbot_events: one row per thing the bot said on its own initiative
-- (a comment, a reply, a milestone, a drought message). It does two jobs:
--
--   * Idempotency. (cycle_id, event_key) is unique, and the app inserts the
--     row BEFORE speaking. A retried request or a cron that runs twice hits
--     the conflict and stays quiet.
--   * Caps. "At most two unprompted comments a day" is a count over this
--     table by kind and fired_at.
--
-- Service role only: members have no reason to read the bot's diary.
--
-- users.roast_me: a member may let GuildBot tease them by @name, in the app
-- only. Off by default. Never honoured on a ghost post, by the app.

CREATE TABLE public.guildbot_events (
  id         bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  cycle_id   uuid        NOT NULL REFERENCES public.cycles(id) ON DELETE CASCADE,
  -- comment | reply | milestone | first_post | drought | ignored
  kind       text        NOT NULL,
  -- Unique per cycle, e.g. comment:<topic>, milestone:<topic>:5, drought:2.
  event_key  text        NOT NULL,
  topic_id   uuid        REFERENCES public.topics(id) ON DELETE SET NULL,
  fired_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (cycle_id, event_key)
);

CREATE INDEX idx_guildbot_events_kind_time ON public.guildbot_events (kind, fired_at DESC);
CREATE INDEX idx_guildbot_events_topic ON public.guildbot_events (topic_id);

ALTER TABLE public.guildbot_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.guildbot_events FROM anon, authenticated;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS roast_me boolean NOT NULL DEFAULT false;

-- 028 made users' readable columns an explicit list; a new column needs its
-- own grant. Members may see who opted in (it changes how the bot talks to
-- them, in public). Writes go through the API, which uses the service role.
GRANT SELECT (roast_me) ON public.users TO authenticated;
