// ROUTE: POST /api/auth/logout
// AUTH: required
// PURPOSE: Sign out current user and clear session cookies
// DB TABLES: none
// RLS: server client

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { GUEST_COOKIE } from '@/lib/guest'

export async function POST(request: Request) {
  const supabase = await createClient()
  await supabase.auth.signOut()

  const { origin } = new URL(request.url)
  const res = NextResponse.redirect(`${origin}/login`, { status: 302 })
  res.cookies.delete(GUEST_COOKIE)
  return res
}
