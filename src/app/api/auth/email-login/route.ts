// ROUTE: POST /api/auth/email-login
// AUTH: none (public login endpoint)
// PURPOSE: Sign in a user with email and password, sets session cookie
// DB TABLES: none (auth only)
// RLS: server client

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const { email, password } = await request.json()

  if (!email || !password) {
    return NextResponse.json(
      { message: 'Email and password are required' },
      { status: 400 }
    )
  }

  try {
    // Use server client so session cookies are automatically set via next/headers
    const supabase = await createClient()

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })

    if (error || !data.session) {
      return NextResponse.json(
        { message: error?.message || 'Invalid email or password' },
        { status: 401 }
      )
    }

    return NextResponse.json({ message: 'Sign in successful' }, { status: 200 })
  } catch (error: any) {
    return NextResponse.json(
      { message: error?.message || 'An error occurred' },
      { status: 500 }
    )
  }
}
