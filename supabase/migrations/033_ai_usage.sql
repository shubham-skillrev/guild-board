-- ============================================================
-- Migration 033: A daily cap on paid AI calls
-- ============================================================
--
-- Gemini (free tier) answers first; when both Gemini models are out of quota
-- the app falls back to OpenAI, which costs money. This counts those calls
-- per UTC day so a runaway loop cannot run up a bill
-- (src/lib/ai/openai.ts, OPENAI_DAILY_CAP, default 200).
--
-- ai_usage_take(provider, cap) adds one call and says whether it was within
-- the cap, in one statement, so parallel serverless instances cannot both
-- take the last call. Service role only: no member can read or spend it.
-- Without this migration the app never calls OpenAI.

CREATE TABLE public.ai_usage (
  day      date    NOT NULL DEFAULT (now() AT TIME ZONE 'utc')::date,
  provider text    NOT NULL,
  calls    integer NOT NULL DEFAULT 0,
  PRIMARY KEY (day, provider)
);

ALTER TABLE public.ai_usage ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ai_usage FROM anon, authenticated;

CREATE FUNCTION public.ai_usage_take(p_provider text, p_cap integer)
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  INSERT INTO public.ai_usage AS u (day, provider, calls)
  VALUES ((now() AT TIME ZONE 'utc')::date, p_provider, 1)
  ON CONFLICT (day, provider) DO UPDATE SET calls = u.calls + 1
  RETURNING calls <= p_cap;
$$;

REVOKE ALL ON FUNCTION public.ai_usage_take(text, integer) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.ai_usage_take(text, integer) TO service_role;
