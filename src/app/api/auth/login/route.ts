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

// Where to land after sign-in, carried in a short-lived cookie rather than on
// the OAuth redirect URL, so the Supabase redirect allowlist stays one exact
// entry. Only known intents are accepted: this is not an open redirect.
const INTENT_COOKIE = 'gb_intent'
const INTENTS = new Set(['share'])

export async function POST(request: Request) {
  const appOrigin = resolveAppOrigin()
  const form = await request.formData().catch(() => null)
  const intent = form?.get('intent')
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
  const response = NextResponse.redirect(data.url, { status: 302 })
  if (typeof intent === 'string' && INTENTS.has(intent)) {
    response.cookies.set(INTENT_COOKIE, intent, {
      httpOnly: true,
      sameSite: 'lax',
      secure: appOrigin.startsWith('https://'),
      path: '/api/auth',
      maxAge: 600,
    })
  }
  return response
}
