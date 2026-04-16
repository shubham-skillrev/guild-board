// ROUTE: POST /api/auth/login
// AUTH: none (initiates OAuth flow)
// PURPOSE: Initiate Google OAuth sign-in via Supabase
// DB TABLES: none
// RLS: server client

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

function resolveAppOrigin(): string {
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (!configured) throw new Error('NEXT_PUBLIC_APP_URL env var is not set')
  return configured.replace(/\/$/, '')
}

export async function POST() {
  const appOrigin = resolveAppOrigin()
  const supabase = await createClient()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${appOrigin}/api/auth/callback`,
    },
  })

  if (error || !data.url) {
    // 302 ensures browser switches to GET (form POSTs must not get 307 which preserves POST)
    return NextResponse.redirect(`${appOrigin}/login?error=oauth_failed`, { status: 302 })
  }

  // 302 (not default 307) so the browser converts to GET when following to Supabase OAuth
  return NextResponse.redirect(data.url, { status: 302 })
}
