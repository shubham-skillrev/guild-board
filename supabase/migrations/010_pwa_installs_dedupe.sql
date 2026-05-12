-- ============================================================
-- Migration 010: Dedupe PWA install rows per user
-- ============================================================

-- Collapse existing duplicates: keep earliest app_installed per user.
DELETE FROM public.pwa_installs a
USING public.pwa_installs b
WHERE a.event = 'app_installed'
  AND b.event = 'app_installed'
  AND a.user_id IS NOT NULL
  AND a.user_id = b.user_id
  AND a.created_at > b.created_at;

-- One app_installed row per authenticated user.
CREATE UNIQUE INDEX uniq_pwa_install_user
  ON public.pwa_installs(user_id)
  WHERE event = 'app_installed' AND user_id IS NOT NULL;
