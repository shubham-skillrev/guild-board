-- ============================================================
-- Migration 009: PWA install analytics
-- ============================================================

CREATE TABLE public.pwa_installs (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        REFERENCES public.users(id) ON DELETE SET NULL,
  event      text        NOT NULL CHECK (event IN ('prompt_accepted', 'prompt_dismissed', 'app_installed')),
  platform   text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_pwa_installs_user_id ON public.pwa_installs(user_id);
CREATE INDEX idx_pwa_installs_event ON public.pwa_installs(event);
CREATE INDEX idx_pwa_installs_created_at ON public.pwa_installs(created_at DESC);

ALTER TABLE public.pwa_installs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pwa_installs_insert_own"
  ON public.pwa_installs FOR INSERT
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Admin-only read via service role (no SELECT policy for regular users).
