// ROUTE: POST /api/auth/login
// AUTH: none (initiates OAuth flow)
// PURPOSE: Initiate Google OAuth sign-in via Supabase
// DB TABLES: none
// RLS: server client

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

function resolveAppOrigin(request: Request): string {
  const url = new URL(request.url)
  const configured = process.env.NEXT_PUBLIC_APP_URL?.trim()
  if (configured) return configured.replace(/\/$/, '')

  const forwardedHost = request.headers.get('x-forwarded-host')
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const host = forwardedHost ?? request.headers.get('host')
  if (!host) return url.origin

  const proto = forwardedProto ?? (host.includes('localhost') ? 'http' : 'https')
  return `${proto}://${host}`
}

export async function POST(request: Request) {
  const appOrigin = resolveAppOrigin(request)
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
