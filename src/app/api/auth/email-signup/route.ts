// ROUTE: POST /api/auth/email-signup
// AUTH: none (public sign-up endpoint)
// PURPOSE: Register a new user with email and password via admin API
// DB TABLES: users
// RLS: admin client (bypasses RLS to auto-confirm and create profile)

import { createAdminClient } from '@/lib/supabase/admin'
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

  if (password.length < 6) {
    return NextResponse.json(
      { message: 'Password must be at least 6 characters' },
      { status: 400 }
    )
  }

  try {
    const admin = createAdminClient()

    // Create auth user with auto email confirmation (no email verification step)
    const { data, error } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
    })

    if (error || !data.user) {
      return NextResponse.json(
        { message: error?.message || 'Sign up failed' },
        { status: 400 }
      )
    }

    // Create user profile record (admin client bypasses RLS)
    const { error: profileError } = await admin
      .from('users')
      .insert({
        id: data.user.id,
        email: normalizedEmail,
        username: `user_${data.user.id.slice(0, 8)}`,
        role: 'user',
      })

    if (profileError) {
      // User was created in auth but profile failed — roll back
      await admin.auth.admin.deleteUser(data.user.id)
      return NextResponse.json(
        { message: `Failed to create user profile: ${profileError.message}` },
        { status: 400 }
      )
    }

    return NextResponse.json({ message: 'Sign up successful, please sign in' }, { status: 200 })
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || 'An error occurred' },
      { status: 500 }
    )
  }
}
