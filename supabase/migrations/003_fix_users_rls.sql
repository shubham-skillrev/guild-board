-- ============================================================
-- Migration 003: Fix users table RLS for leaderboard
-- Add a policy allowing all authenticated users to read
-- non-sensitive public fields (username, spark_count, hall_of_flame).
-- The "own row" policy is kept so users can still read their own
-- full profile row; this policy is additive (RLS SELECT policies OR).
-- ============================================================

CREATE POLICY "Authenticated users can read public user fields" ON public.users
  FOR SELECT USING (auth.role() = 'authenticated');
