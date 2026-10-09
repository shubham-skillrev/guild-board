-- ============================================================
-- Migration 032: GuildBot chat history
-- ============================================================
--
-- One private thread per member, so the chat survives a reload and the bot
-- remembers the last few turns. Read and written only by the API with the
-- service role, always filtered to the signed-in member: no member, admins
-- included, can read anyone else's chat through the app.
--
-- Not kept: on meeting day GuildBot shares anonymous themes from the month's
-- questions in Slack (never who asked what) and then deletes every row. The
-- daily GuildBot cron also deletes anything older than 35 days, as a backstop
-- for a month without a meeting.
-- `draft` holds a topic the bot drafted (shown as a card the member can post);
-- `cites` holds the topics and Bytes the reply linked to.

CREATE TABLE public.guildbot_messages (
  id         bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  role       text        NOT NULL CHECK (role IN ('user', 'bot')),
  body       text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 4000),
  draft      jsonb,
  cites      jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_guildbot_messages_user ON public.guildbot_messages (user_id, created_at DESC);
CREATE INDEX idx_guildbot_messages_age ON public.guildbot_messages (created_at);

ALTER TABLE public.guildbot_messages ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.guildbot_messages FROM anon, authenticated;
