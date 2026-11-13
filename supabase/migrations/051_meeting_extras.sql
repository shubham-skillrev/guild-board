-- ============================================================
-- Migration 051: Meeting mode extras (reactions, ask-anything, word moderation)
-- ============================================================
--
-- Meeting mode v2, Batch 4 extras (docs/08-meeting-mode-v2.md):
--
--   meeting_activities.hidden_words  words the presenter tapped off a word
--                         cloud. aggregate() (src/lib/meet/activity.ts) drops
--                         them, so the screen, every phone and the report
--                         agree. Lower-cased, as cleanWord() merges them.
--   meeting_questions     the ask-anything queue: anonymous questions sent
--                         from /meet (members and guests), 1-200 characters,
--                         profanity-filtered and rate-limited by the server
--                         (src/lib/meet/questions.ts). `participant_id` is
--                         kept only for the rate limit and the wipe; it is
--                         never sent to anyone. `shown_at`: the one question
--                         pulled onto the shared screen (at most one per
--                         meeting); `answered_at`: marked answered.
--   meeting_question_votes one upvote per participant per question.
--   meeting_reactions     one row per participant: how many of each reaction
--                         (fire / laugh / clap) they sent and when the last
--                         one went, for the server's rate limit (one per
--                         1.5 s, a cap per meeting). The room's totals ride
--                         the existing `meeting:{cycle_id}` broadcast; the
--                         screen floats the difference.
--
-- Everything hangs off meeting_participants with ON DELETE CASCADE, so the
-- live rehearsal's wipe (deleting the month's participants) and an undone
-- accidental start take questions, votes and reactions with them.
--
-- Additive. Until it's applied: no reactions row and no ask-anything on the
-- phones, the presenter screen says "apply migration 051", and tapping a
-- cloud word to hide it says the same. Service role only, like 046.

ALTER TABLE public.meeting_activities
  ADD COLUMN IF NOT EXISTS hidden_words text[] NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS public.meeting_questions (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id       uuid        NOT NULL REFERENCES public.meetings(cycle_id) ON DELETE CASCADE,
  participant_id uuid        NOT NULL REFERENCES public.meeting_participants(id) ON DELETE CASCADE,
  body           text        NOT NULL CHECK (char_length(body) BETWEEN 1 AND 200),
  created_at     timestamptz NOT NULL DEFAULT now(),
  answered_at    timestamptz,
  shown_at       timestamptz
);
CREATE INDEX IF NOT EXISTS meeting_questions_cycle ON public.meeting_questions (cycle_id);
CREATE INDEX IF NOT EXISTS meeting_questions_participant ON public.meeting_questions (participant_id);
-- At most one question on the shared screen per meeting.
CREATE UNIQUE INDEX IF NOT EXISTS meeting_questions_one_shown ON public.meeting_questions (cycle_id) WHERE shown_at IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.meeting_question_votes (
  question_id    uuid        NOT NULL REFERENCES public.meeting_questions(id) ON DELETE CASCADE,
  participant_id uuid        NOT NULL REFERENCES public.meeting_participants(id) ON DELETE CASCADE,
  created_at     timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (question_id, participant_id)
);
CREATE INDEX IF NOT EXISTS meeting_question_votes_participant ON public.meeting_question_votes (participant_id);

CREATE TABLE IF NOT EXISTS public.meeting_reactions (
  participant_id uuid        PRIMARY KEY REFERENCES public.meeting_participants(id) ON DELETE CASCADE,
  cycle_id       uuid        NOT NULL REFERENCES public.meetings(cycle_id) ON DELETE CASCADE,
  fire           integer     NOT NULL DEFAULT 0 CHECK (fire >= 0),
  laugh          integer     NOT NULL DEFAULT 0 CHECK (laugh >= 0),
  clap           integer     NOT NULL DEFAULT 0 CHECK (clap >= 0),
  last_at        timestamptz
);
CREATE INDEX IF NOT EXISTS meeting_reactions_cycle ON public.meeting_reactions (cycle_id);

ALTER TABLE public.meeting_questions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_question_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_reactions      ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.meeting_questions, public.meeting_question_votes, public.meeting_reactions FROM anon, authenticated;
