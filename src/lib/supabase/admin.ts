import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// WARNING: This client bypasses RLS. Only import in /api/admin/* routes or server-only auth routes.
// Never expose to the browser or client components.
export function createAdminClient() {
  // SUPABASE_SERVICE_ROLE_KEY (JWT) or SUPABASE_SECRET_KEY (new format) — both work
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey!
  )
}
