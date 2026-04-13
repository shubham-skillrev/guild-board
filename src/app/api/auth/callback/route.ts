// ROUTE: GET /api/auth/callback
// AUTH: none (OAuth callback from Supabase)
// PURPOSE: Exchange OAuth code for session; create user row on first login
// DB TABLES: users
// RLS: server client

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { isAllowedEmailDomain } from '@/lib/utils/email'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  if (!isAllowedEmailDomain(data.user.email ?? null)) {
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/login?error=domain_not_allowed`)
  }

  const admin = createAdminClient()

  const { data: existingUser } = await admin
    .from('users')
    .select('id, username')
    .eq('id', data.user.id)
    .single()

  if (!existingUser) {
    // First login — insert user row; empty username triggers setup modal
    const { error: insertError } = await admin.from('users').insert({
      id: data.user.id,
      email: data.user.email ?? '',
      real_name: data.user.user_metadata?.full_name ?? '',
      username: `user_${data.user.id.slice(0, 8)}`, // temp username, user will update
    })
    if (insertError) {
      console.error('Insert Error details:', insertError)
      return NextResponse.redirect(`${origin}/login?error=user_creation_failed`)
    }
    return NextResponse.redirect(`${origin}/board?setup=username`)
  }

  if (!existingUser.username || existingUser.username.startsWith('user_')) {
    return NextResponse.redirect(`${origin}/board?setup=username`)
  }

  return NextResponse.redirect(`${origin}/board`)
}
