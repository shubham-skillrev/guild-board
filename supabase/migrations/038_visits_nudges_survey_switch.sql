-- ============================================================
-- Migration 038: Daily visits, "No nudges", survey open/close
-- ============================================================
--
-- 1. user_visits: one row per member per day (India time), so the admin
--    dashboard can say who was here, how often, where, and whether they use
--    the installed app or have notifications on:
--
--      first_seen / last_seen  the day's first and latest page
--      visits                  page loads 30+ minutes apart count as a new visit
--      areas                   which parts they opened (board, topic, bytes...)
--      app                     opened as the installed app at least once that day
--      push                    browser notification permission at the last page:
--                              'granted' | 'denied' | 'default' | 'unsupported'
--
--    Written only through record_visit(), which takes the member from the
--    session (auth.uid()), never from the caller. Read only by the service
--    role (admin dashboard). Kept 180 days; older days are folded into
--    user_visits_monthly by rollup_user_visits(), run from the daily cron.
--
-- 2. users.nudges_off: the member's "No nudges" switch on their profile.
--    Admins can never nudge someone who turned it on.
--
-- 3. surveys: an open/closed switch (and optional close date) per survey
--    run. Closed means no board card and /survey says the results go up at
--    the meeting. The first run, pulse-2026-11, starts open.

-- ─── 1. Daily visits ───

CREATE TABLE public.user_visits (
  user_id    uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  day        date        NOT NULL,
  first_seen timestamptz NOT NULL DEFAULT now(),
  last_seen  timestamptz NOT NULL DEFAULT now(),
  visits     integer     NOT NULL DEFAULT 1 CHECK (visits >= 1),
  areas      text[]      NOT NULL DEFAULT '{}',
  app        boolean     NOT NULL DEFAULT false,
  push       text        NOT NULL DEFAULT 'default' CHECK (push IN ('granted', 'denied', 'default', 'unsupported')),
  PRIMARY KEY (user_id, day)
);

CREATE INDEX idx_user_visits_day ON public.user_visits (day DESC);

ALTER TABLE public.user_visits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_visits FROM anon, authenticated;

CREATE TABLE public.user_visits_monthly (
  user_id      uuid    NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  month        date    NOT NULL, -- first day of the month
  days_active  integer NOT NULL,
  visits       integer NOT NULL,
  app_days     integer NOT NULL,
  areas        text[]  NOT NULL DEFAULT '{}',
  PRIMARY KEY (user_id, month)
);

ALTER TABLE public.user_visits_monthly ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_visits_monthly FROM anon, authenticated;

-- One call per page view from a signed-in member. Areas are a fixed set so a
-- caller cannot fill the column with junk.
CREATE OR REPLACE FUNCTION public.record_visit(p_area text, p_app boolean, p_push text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_area text := CASE WHEN p_area IN ('board', 'topic', 'bytes', 'bank', 'leaderboard', 'profile', 'admin', 'survey', 'other') THEN p_area ELSE 'other' END;
  v_push text := CASE WHEN p_push IN ('granted', 'denied', 'default', 'unsupported') THEN p_push ELSE 'default' END;
BEGIN
  IF v_uid IS NULL OR NOT EXISTS (SELECT 1 FROM public.users u WHERE u.id = v_uid) THEN
    RETURN;
  END IF;

  INSERT INTO public.user_visits AS uv (user_id, day, areas, app, push)
  VALUES (v_uid, (now() AT TIME ZONE 'Asia/Kolkata')::date, ARRAY[v_area], COALESCE(p_app, false), v_push)
  ON CONFLICT (user_id, day) DO UPDATE SET
    visits    = uv.visits + CASE WHEN now() - uv.last_seen > interval '30 minutes' THEN 1 ELSE 0 END,
    last_seen = now(),
    areas     = CASE WHEN v_area = ANY (uv.areas) THEN uv.areas ELSE uv.areas || v_area END,
    app       = uv.app OR EXCLUDED.app,
    push      = EXCLUDED.push;
END;
$$;

REVOKE ALL ON FUNCTION public.record_visit(text, boolean, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.record_visit(text, boolean, text) TO authenticated;

-- Folds days older than 180 into monthly rows, then deletes them. Safe to run
-- daily: a month is only ever added to, and only whole old days move.
CREATE OR REPLACE FUNCTION public.rollup_user_visits()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cutoff date := (now() AT TIME ZONE 'Asia/Kolkata')::date - 180;
  v_moved  integer;
BEGIN
  WITH old AS (
    SELECT * FROM public.user_visits WHERE day < v_cutoff
  ), totals AS (
    SELECT user_id, date_trunc('month', day)::date AS month,
           count(*)::int AS days_active, sum(visits)::int AS visits,
           (count(*) FILTER (WHERE app))::int AS app_days
    FROM old GROUP BY 1, 2
  ), opened AS (
    SELECT user_id, date_trunc('month', day)::date AS month, array_agg(DISTINCT a) AS areas
    FROM old, unnest(old.areas) AS a GROUP BY 1, 2
  )
  INSERT INTO public.user_visits_monthly AS m (user_id, month, days_active, visits, app_days, areas)
  SELECT t.user_id, t.month, t.days_active, t.visits, t.app_days, COALESCE(o.areas, '{}')
  FROM totals t LEFT JOIN opened o USING (user_id, month)
  ON CONFLICT (user_id, month) DO UPDATE SET
    days_active = m.days_active + EXCLUDED.days_active,
    visits      = m.visits + EXCLUDED.visits,
    app_days    = m.app_days + EXCLUDED.app_days,
    areas       = ARRAY(SELECT DISTINCT x FROM unnest(m.areas || EXCLUDED.areas) AS x);

  DELETE FROM public.user_visits WHERE day < v_cutoff;
  GET DIAGNOSTICS v_moved = ROW_COUNT;
  RETURN v_moved;
END;
$$;

REVOKE ALL ON FUNCTION public.rollup_user_visits() FROM public, anon, authenticated;

-- ─── 2. "No nudges" ───

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS nudges_off boolean NOT NULL DEFAULT false;

GRANT SELECT (nudges_off) ON public.users TO authenticated;

-- ─── 3. Survey open/close ───

CREATE TABLE public.surveys (
  key        text        PRIMARY KEY CHECK (char_length(key) BETWEEN 1 AND 40),
  open       boolean     NOT NULL DEFAULT true,
  closes_at  timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.surveys FROM anon, authenticated;

INSERT INTO public.surveys (key, open) VALUES ('pulse-2026-11', true)
ON CONFLICT (key) DO NOTHING;
