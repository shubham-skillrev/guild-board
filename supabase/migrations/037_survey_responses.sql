-- ============================================================
-- Migration 037: Guild survey responses
-- ============================================================
--
-- /survey is public: anyone at SkillRev can answer without an account, so
-- the people who never signed up are heard too. Each answer carries a name
-- and a @skillrev.dev email (checked by the API), one row per email per
-- survey: answering again replaces the earlier row.
--
-- `verified` is true only when the answer came from a signed-in session,
-- where the email is Google's, not typed. A typed answer can never replace a
-- verified one (the API refuses), so nobody can overwrite a colleague's
-- signed-in answer by typing their address.
--
-- `survey` keys the run ('pulse-2026-11'), so the same questions can be asked
-- again later and compared.
--
-- Names and emails are personal: read and written only by the API with the
-- service role. Admins see them in the admin panel; meetings get counts only.

CREATE TABLE public.survey_responses (
  id            bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  survey        text        NOT NULL CHECK (char_length(survey) BETWEEN 1 AND 40),
  email         text        NOT NULL CHECK (email = lower(email) AND char_length(email) BETWEEN 3 AND 254),
  name          text        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  user_id       uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  verified      boolean     NOT NULL DEFAULT false,
  role          text        NOT NULL CHECK (role IN ('dev', 'devops', 'qa', 'pm', 'scrum_master', 'design', 'other')),
  attended      text        CHECK (attended IN ('regularly', 'once_or_twice', 'never')),
  join_reasons  text[]      NOT NULL DEFAULT '{}' CHECK (cardinality(join_reasons) <= 3),
  join_other    text        CHECK (char_length(join_other) <= 120),
  learn_next    text        CHECK (char_length(learn_next) <= 200),
  demo          text        CHECK (demo IN ('yes', 'maybe', 'not_now')),
  demo_idea     text        CHECK (char_length(demo_idea) <= 200),
  nominee_name  text        CHECK (char_length(nominee_name) <= 80),
  nominee_why   text        CHECK (char_length(nominee_why) <= 200),
  meeting_slot  text        CHECK (meeting_slot IN ('morning', 'lunch', 'afternoon', 'evening')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (survey, email)
);

CREATE INDEX idx_survey_responses_survey ON public.survey_responses (survey, updated_at DESC);

ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.survey_responses FROM anon, authenticated;
