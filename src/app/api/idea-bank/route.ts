// ROUTE: GET /api/idea-bank, POST /api/idea-bank, PATCH /api/idea-bank, DELETE /api/idea-bank
// AUTH: authenticated
// PURPOSE: Capture ideas any day of the month, in any cycle phase. Unlimited —
//          the 1-per-cycle cap applies to promotion onto the board, not to banking.
// DB TABLES: idea_bank, users
// RLS: server client (own rows + is_open rows, enforced by policy)

import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { TITLE_MAX_LENGTH } from '@/lib/constants'
import { joinedUsername } from '@/lib/utils/anonymity'
import type { CategoryTag } from '@/types'

const NOTE_MAX_LENGTH = 500
const CATEGORIES = ['deep_dive', 'discussion', 'blog_idea', 'project_showcase']

const SELECT =
  'id,user_id,title,note,category,is_open,is_anonymous,promoted_topic_id,promoted_by,promoted_at,created_at,updated_at,users!idea_bank_user_id_fkey(username)'

type IdeaRow = {
  user_id: string
  is_anonymous: boolean
  users?: { username?: string } | { username?: string }[] | null
  [key: string]: unknown
}

/** Hide the author of an anonymous open idea; expose ownership explicitly. */
function serialize(row: IdeaRow, viewerId: string) {
  const isOwner = row.user_id === viewerId
  const { users, ...rest } = row

  if (row.is_anonymous && !isOwner) {
    const { user_id: _hidden, ...anon } = rest
    return { ...anon, is_owner: false, author_username: 'a guild member' }
  }

  return {
    ...rest,
    is_owner: isOwner,
    author_username: joinedUsername(users) ?? 'unknown',
  }
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // ?scope=open  → the up-for-grabs pool (everyone's, unpromoted)
  // default      → the caller's own bank
  const scope = new URL(request.url).searchParams.get('scope')

  let query = supabase.from('idea_bank').select(SELECT).order('created_at', { ascending: false })

  if (scope === 'open') {
    query = query.eq('is_open', true).is('promoted_topic_id', null)
  } else {
    query = query.eq('user_id', user.id)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json((data ?? []).map(row => serialize(row, user.id)))
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    title?: string
    note?: string
    category?: CategoryTag
    is_open?: boolean
    is_anonymous?: boolean
  }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const title = body.title?.trim()
  const note = body.note?.trim() || null

  if (!title) return NextResponse.json({ error: 'title is required' }, { status: 400 })
  if (title.length < 3) return NextResponse.json({ error: 'Title too short (min 3 characters)' }, { status: 400 })
  if (title.length > TITLE_MAX_LENGTH) return NextResponse.json({ error: 'Title too long' }, { status: 400 })
  if (note && note.length > NOTE_MAX_LENGTH) {
    return NextResponse.json({ error: `Note too long (max ${NOTE_MAX_LENGTH} characters)` }, { status: 400 })
  }
  if (body.category && !CATEGORIES.includes(body.category)) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
  }

  // No quota check on purpose — banking is unlimited in every cycle phase.
  const { data, error } = await supabase
    .from('idea_bank')
    .insert({
      user_id: user.id,
      title,
      note,
      category: body.category ?? null,
      is_open: body.is_open === true,
      is_anonymous: body.is_anonymous === true,
    })
    .select(SELECT)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(serialize(data, user.id), { status: 201 })
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    id?: string
    title?: string
    note?: string
    category?: CategoryTag
    is_open?: boolean
    is_anonymous?: boolean
  }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { id } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data: existing, error: existingErr } = await supabase
    .from('idea_bank')
    .select('user_id, promoted_topic_id')
    .eq('id', id)
    .maybeSingle()

  if (existingErr) return NextResponse.json({ error: existingErr.message }, { status: 500 })
  if (!existing) return NextResponse.json({ error: 'Idea not found' }, { status: 404 })
  if (existing.user_id !== user.id) return NextResponse.json({ error: 'Not your idea' }, { status: 403 })
  if (existing.promoted_topic_id) {
    return NextResponse.json({ error: 'Already on the board — edit the topic instead' }, { status: 409 })
  }

  const updates: Record<string, unknown> = {}

  if (body.title !== undefined) {
    const title = body.title.trim()
    if (title.length < 3) return NextResponse.json({ error: 'Title too short (min 3 characters)' }, { status: 400 })
    if (title.length > TITLE_MAX_LENGTH) return NextResponse.json({ error: 'Title too long' }, { status: 400 })
    updates.title = title
  }
  if (body.note !== undefined) {
    const note = body.note.trim()
    if (note.length > NOTE_MAX_LENGTH) {
      return NextResponse.json({ error: `Note too long (max ${NOTE_MAX_LENGTH} characters)` }, { status: 400 })
    }
    updates.note = note || null
  }
  if (body.category !== undefined) {
    if (body.category && !CATEGORIES.includes(body.category)) {
      return NextResponse.json({ error: 'Invalid category' }, { status: 400 })
    }
    updates.category = body.category ?? null
  }
  if (body.is_open !== undefined) updates.is_open = body.is_open === true
  if (body.is_anonymous !== undefined) updates.is_anonymous = body.is_anonymous === true

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('idea_bank')
    .update(updates)
    .eq('id', id)
    .select(SELECT)
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(serialize(data, user.id))
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { id?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { id } = body
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

  const { data: existing } = await supabase
    .from('idea_bank')
    .select('user_id, promoted_topic_id')
    .eq('id', id)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: 'Idea not found' }, { status: 404 })
  if (existing.user_id !== user.id) return NextResponse.json({ error: 'Not your idea' }, { status: 403 })
  if (existing.promoted_topic_id) {
    return NextResponse.json({ error: 'Already on the board — delete the topic instead' }, { status: 409 })
  }

  // Hard delete: a banked idea is a private note, not shared history.
  const { error } = await supabase.from('idea_bank').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
