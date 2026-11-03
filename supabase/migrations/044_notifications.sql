-- ============================================================
-- Migration 044: The notification centre
-- ============================================================
--
-- Every notification GuildBoard sends a member is also kept here, whether or
-- not they have push turned on, so the bell in the top bar can show it:
-- replies, votes, sparks, invitations, notes from organisers, the meeting
-- reminder, a new month, Bytes, announcements, role changes.
--
--   kind     the push tag's prefix ('topic', 'spotlight-invite', 'announce'...)
--   read_at  NULL until opened or "mark all read"
--
-- Read and written only through the API with the service role, always
-- filtered to the signed-in member. Rows older than 90 days are deleted by
-- the daily cron.

CREATE TABLE public.notifications (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kind       text        NOT NULL DEFAULT 'general' CHECK (char_length(kind) <= 40),
  title      text        NOT NULL CHECK (char_length(title) <= 200),
  body       text        CHECK (char_length(body) <= 600),
  url        text        CHECK (char_length(url) <= 500),
  read_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_notifications_user ON public.notifications (user_id, created_at DESC);
CREATE INDEX idx_notifications_unread ON public.notifications (user_id) WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notifications FROM anon, authenticated;
