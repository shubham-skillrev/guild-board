// ROUTE: POST /api/auth/email-login
// AUTH: none (public login endpoint)
// PURPOSE: Sign in a user with email and password, sets session cookie
// DB TABLES: none (auth only)
// RLS: server client

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { getAllowedEmailDomainLabel, isAllowedEmailDomain } from '@/lib/utils/email'

export async function POST(request: Request) {
  const { email, password } = await request.json()
  const normalizedEmail = String(email ?? '').trim().toLowerCase()

  if (!normalizedEmail || !password) {
    return NextResponse.json(
      { message: 'Email and password are required' },
      { status: 400 }
    )
  }

  if (!isAllowedEmailDomain(normalizedEmail)) {
    return NextResponse.json(
      { message: `Only @${getAllowedEmailDomainLabel()} email addresses are allowed` },
      { status: 400 }
    )
  }

  try {
    // Use server client so session cookies are automatically set via next/headers
    const supabase = await createClient()

    const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password })

    if (error || !data.session) {
      return NextResponse.json(
        { message: error?.message || 'Invalid email or password' },
        { status: 401 }
      )
    }

    const { data: profile } = await supabase
      .from('users')
      .select('username')
      .eq('id', data.user.id)
      .maybeSingle()

    const needsUsernameSetup = !profile?.username || profile.username.startsWith('user_')

    return NextResponse.json({ message: 'Sign in successful', needsUsernameSetup }, { status: 200 })
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || 'An error occurred' },
      { status: 500 }
    )
  }
}
