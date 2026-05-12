-- ============================================================
-- Migration 008: Web push subscriptions + notification prefs
-- ============================================================

-- ─── Table: push_subscriptions ───────────────────────────────
CREATE TABLE public.push_subscriptions (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid        NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint     text        NOT NULL UNIQUE,
  p256dh       text        NOT NULL,
  auth         text        NOT NULL,
  user_agent   text,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_push_subs_user_id ON public.push_subscriptions(user_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users manage only their own subscriptions.
CREATE POLICY "push_subs_select_own"
  ON public.push_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "push_subs_insert_own"
  ON public.push_subscriptions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "push_subs_update_own"
  ON public.push_subscriptions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "push_subs_delete_own"
  ON public.push_subscriptions FOR DELETE
  USING (auth.uid() = user_id);

-- ─── Table: notification_prefs ───────────────────────────────
CREATE TABLE public.notification_prefs (
  user_id        uuid        PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  push_replies   boolean     NOT NULL DEFAULT true,
  push_reactions boolean     NOT NULL DEFAULT true,
  push_votes     boolean     NOT NULL DEFAULT false,
  updated_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_prefs_select_own"
  ON public.notification_prefs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "notif_prefs_upsert_own"
  ON public.notification_prefs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "notif_prefs_update_own"
  ON public.notification_prefs FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
