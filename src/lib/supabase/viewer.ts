import { cookies } from 'next/headers'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { GUEST_COOKIE, GUEST_USER_ID } from '@/lib/guest'

export interface Viewer {
  supabase: SupabaseClient
  user: { id: string } | null
  isGuest: boolean
}

/**
 * Who is reading, for read-only (GET) handlers and server pages.
 *
 * A real session always wins. Failing that, a guest gets the service-role
 * client, because RLS has no policy for an unauthenticated reader. That client
 * bypasses RLS entirely, so any query run through it must filter explicitly for
 * what RLS would otherwise hide (deleted rows, unpublished digests, private
 * idea-bank drafts). Never use this in a handler that writes.
 */
export async function getViewer(): Promise<Viewer> {
  const supabase = await createClient()
  // Read-only callers: a locally verified JWT is enough (RLS checks the same
  // token again on every query), and it skips a round trip to Supabase Auth.
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  if (userId) return { supabase, user: { id: userId }, isGuest: false }

  if (await isGuestSession()) {
    return { supabase: createAdminClient(), user: { id: GUEST_USER_ID }, isGuest: true }
  }

  return { supabase, user: null, isGuest: false }
}

export async function isGuestSession(): Promise<boolean> {
  const store = await cookies()
  return store.get(GUEST_COOKIE)?.value === '1'
}
