// ROUTE: GET /api/admin/bytes, PATCH /api/admin/bytes, DELETE /api/admin/bytes
// AUTH: admin only
// PURPOSE: Curate a live digest - edit summaries, add your own take, reorder,
//          drop items. There is no publish step: digests are live on creation
//          and the admin edits in place.
// DB TABLES: byte_digests, bytes, users
// RLS: admin client throughout (drafts are invisible under RLS by design)

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'

const SUMMARY_MAX = 400
const NOTE_MAX = 300

/** Shared admin gate. Returns the admin client, or a response to return. */
async function requireAdmin() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const admin = createAdminClient()
  const { data: me } = await admin.from('users').select('role').eq('id', user.id).maybeSingle()
  if (me?.role !== 'admin') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { admin, userId: user.id }
}

/** GET ?digest_id=… → one digest; omit for the most recent. */
export async function GET(request: Request) {
  const gate = await requireAdmin()
  if (gate.error) return gate.error
  const { admin } = gate

  const digestId = new URL(request.url).searchParams.get('digest_id')

  const query = admin
    .from('byte_digests')
    .select('id, label, status, cycle_id, published_at, created_at')
    .order('created_at', { ascending: false })
    .limit(1)

  const { data: digest } = digestId
    ? await admin
        .from('byte_digests')
        .select('id, label, status, cycle_id, published_at, created_at')
        .eq('id', digestId)
        .maybeSingle()
    : await query.maybeSingle()

  if (!digest) return NextResponse.json({ digest: null, bytes: [] })

  const { data: bytes } = await admin
    .from('bytes')
    .select('*')
    .eq('digest_id', digest.id)
    .order('position', { ascending: true })

  return NextResponse.json({ digest, bytes: bytes ?? [] })
}

/**
 * PATCH - three shapes:
 *   { byte_id, summary?, editor_note?, position? }  edit one byte
 *   { digest_id, label }                            rename the digest
 *   { digest_id, hidden: bool }                     hide or restore
 */
export async function PATCH(request: Request) {
  const gate = await requireAdmin()
  if (gate.error) return gate.error
  const { admin } = gate

  let body: {
    byte_id?: string
    summary?: string
    editor_note?: string
    position?: number
    digest_id?: string
    label?: string
    hidden?: boolean
  }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  // ─── Edit a single byte ───
  if (body.byte_id) {
    const updates: Record<string, unknown> = {}

    if (body.summary !== undefined) {
      const s = body.summary.trim()
      if (s.length > SUMMARY_MAX) {
        return NextResponse.json({ error: `Summary too long (max ${SUMMARY_MAX})` }, { status: 400 })
      }
      updates.summary = s || null
    }
    if (body.editor_note !== undefined) {
      const n = body.editor_note.trim()
      if (n.length > NOTE_MAX) {
        return NextResponse.json({ error: `Note too long (max ${NOTE_MAX})` }, { status: 400 })
      }
      updates.editor_note = n || null
    }
    if (body.position !== undefined) updates.position = body.position

    if (!Object.keys(updates).length) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    // source_title and url are deliberately not editable here - they are the
    // grounded record of what the feed actually returned.
    const { data, error } = await admin
      .from('bytes')
      .update(updates)
      .eq('id', body.byte_id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  if (!body.digest_id) {
    return NextResponse.json({ error: 'byte_id or digest_id required' }, { status: 400 })
  }

  // ─── Visibility ───
  // Digests are live from creation, so there is no publish step. This only
  // exists to pull one back if something needs fixing in public.
  if (body.hidden !== undefined) {
    const { data, error } = await admin
      .from('byte_digests')
      .update({ status: body.hidden ? 'draft' : 'published' })
      .eq('id', body.digest_id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  // ─── Rename ───
  if (body.label !== undefined) {
    const label = body.label.trim()
    if (!label) return NextResponse.json({ error: 'Label required' }, { status: 400 })

    const { data, error } = await admin
      .from('byte_digests')
      .update({ label })
      .eq('id', body.digest_id)
      .select()
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
}

/** DELETE - drop one byte, or the whole digest. */
export async function DELETE(request: Request) {
  const gate = await requireAdmin()
  if (gate.error) return gate.error
  const { admin } = gate

  let body: { byte_id?: string; digest_id?: string }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  if (body.byte_id) {
    const { error } = await admin.from('bytes').delete().eq('id', body.byte_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  if (body.digest_id) {
    const { error } = await admin.from('byte_digests').delete().eq('id', body.digest_id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'byte_id or digest_id required' }, { status: 400 })
}
