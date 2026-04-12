// ROUTE: POST /api/auth/login
// AUTH: none (initiates OAuth flow)
// PURPOSE: Initiate Google OAuth sign-in via Supabase
// DB TABLES: none
// RLS: server client

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { origin } = new URL(request.url)
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${origin}/api/auth/callback`,
    },
  })

  if (error || !data.url) {
    // 302 ensures browser switches to GET (form POSTs must not get 307 which preserves POST)
    return NextResponse.redirect(`${origin}/login?error=oauth_failed`, { status: 302 })
  }

  // 302 (not default 307) so the browser converts to GET when following to Supabase OAuth
  return NextResponse.redirect(data.url, { status: 302 })
}
