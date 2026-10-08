-- 026  A theme per month, and a record of what the guild was told
--
-- Themes. Problem Month was a build-time flag, so every past month on the
-- board wore whatever the code said this month was. Each cycle now carries its
-- own theme: the copy the board, the landing page, the share form and the
-- cycle-open message use, plus the post kind it features. Null is a plain
-- month with no theme. The shape is validated by the app (src/lib/themes), not
-- here: it is copy, and copy changes more often than migrations should.
--
-- Board mechanics are not part of a theme. Uncapped reactions (023) and one
-- post per person (025) hold every month.
--
-- Announcements. One row per message an admin sent to Slack and push, with
-- what actually went out and how far it got. It is the history the admin page
-- lists, and what stops the same message going out twice by accident.
-- Written and read only by the service role, so RLS is on with no policies.

ALTER TABLE public.cycles
  ADD COLUMN IF NOT EXISTS theme jsonb;

-- October 2026 was Problem Month. Same words it has been showing, now as data,
-- so applying this changes nothing on screen.
UPDATE public.cycles
SET theme = jsonb_build_object(
  'name', 'Problem Month',
  'title', 'Bring a problem.',
  'accent', 'problem',
  'subtitle', 'This month''s theme: bring a problem',
  'blurb', 'One tech problem you’ve run into lately. A flaky test, a slow build, a design call you’re unsure about. Say what you tried; that’s what starts the conversation.',
  'cta', 'Share a problem',
  'featured_kind', 'problem',
  'open_line', 'Share one tech problem you''ve hit lately. Two lines is enough.'
)
WHERE year = 2026 AND month = 10 AND theme IS NULL;

CREATE TABLE IF NOT EXISTS public.announcements (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text        NOT NULL,
  body        text        NOT NULL,
  slack_text  text        NOT NULL,
  url         text,
  channels    text[]      NOT NULL DEFAULT '{}',
  slack_ok    boolean,
  push_sent   integer,
  sent_by     uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  sent_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_announcements_sent_at
  ON public.announcements (sent_at DESC);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
