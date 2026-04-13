// ROUTE: POST /api/auth/setup-username
// AUTH: authenticated
// PURPOSE: Set or update username for the current user
// DB TABLES: users
// RLS: server client

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

const USERNAME_REGEX = /^[a-z0-9_]{3,30}$/

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { username?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { username } = body

  if (!username || !USERNAME_REGEX.test(username)) {
    return NextResponse.json(
      { error: 'Username must be 3-30 characters, lowercase alphanumeric and underscores only' },
      { status: 400 }
    )
  }

  const normalizedUsername = username.toLowerCase()

  const { data: profile } = await supabase
    .from('users')
    .select('real_name')
    .eq('id', user.id)
    .single()

  const realNameTokens = String(profile?.real_name ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .split(' ')
    .filter(token => token.length >= 3)

  if (realNameTokens.some(token => normalizedUsername.includes(token))) {
    return NextResponse.json(
      { error: 'Username should not include your real name. Pick something more creative.' },
      { status: 400 }
    )
  }

  // Check uniqueness
  const { data: existing } = await supabase
    .from('users')
    .select('id')
    .eq('username', username)
    .neq('id', user.id)
    .single()

  if (existing) {
    return NextResponse.json({ error: 'Username already taken' }, { status: 409 })
  }

  const { error } = await supabase
    .from('users')
    .update({ username })
    .eq('id', user.id)

  if (error) {
    return NextResponse.json({ error: 'Failed to update username' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
