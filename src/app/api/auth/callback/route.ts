// ROUTE: GET /api/auth/callback
// AUTH: none (OAuth callback from Supabase)
// PURPOSE: Exchange OAuth code for session; create user row on first login
// DB TABLES: users
// RLS: server client

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { isAllowedEmailDomain } from '@/lib/utils/email'

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

// Set by /api/auth/login when sign-in started from "Share a problem".
const INTENT_COOKIE = 'gb_intent'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const appOrigin = resolveAppOrigin(request)
  const intent = request.headers.get('cookie')?.match(/(?:^|;\s*)gb_intent=([^;]+)/)?.[1]
  const share = intent === 'share'
  // Every exit from here clears the intent, success or not.
  const redirect = (url: string) => {
    const res = NextResponse.redirect(url)
    if (intent) res.cookies.set(INTENT_COOKIE, '', { path: '/api/auth', maxAge: 0 })
    return res
  }
  const code = searchParams.get('code')

  if (!code) {
    return redirect(`${appOrigin}/login?error=auth_failed`)
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    return redirect(`${appOrigin}/login?error=auth_failed`)
  }

  if (!isAllowedEmailDomain(data.user.email ?? null)) {
    await supabase.auth.signOut()
    return redirect(`${appOrigin}/login?error=domain_not_allowed`)
  }

  const admin = createAdminClient()

  const { data: existingUser } = await admin
    .from('users')
    .select('id, username')
    .eq('id', data.user.id)
    .single()

  if (!existingUser) {
    // First login - insert user row; empty username triggers setup modal
    const { error: insertError } = await admin.from('users').insert({
      id: data.user.id,
      email: data.user.email ?? '',
      real_name: data.user.user_metadata?.full_name ?? '',
      username: `user_${data.user.id.slice(0, 8)}`, // temp username, user will update
    })
    if (insertError) {
      console.error('Insert Error details:', insertError)
      return redirect(`${appOrigin}/login?error=user_creation_failed`)
    }
    return redirect(`${appOrigin}/board?setup=username${share ? '&share=1' : ''}`)
  }

  if (!existingUser.username || existingUser.username.startsWith('user_')) {
    return redirect(`${appOrigin}/board?setup=username${share ? '&share=1' : ''}`)
  }

  return redirect(`${appOrigin}/board${share ? '?share=1' : ''}`)
}
