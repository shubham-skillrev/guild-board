// ROUTE: PATCH /api/demos/[id]
// AUTH: the person the demo belongs to
// PURPOSE: Answer a Spotlight invitation, or withdraw your own offer:
//            { action: 'accept', format, title? }  invited -> confirmed
//            { action: 'pass' }                    invited -> passed
//            { action: 'withdraw' }                proposed -> cancelled
//          Two passes a year. After that an invitation can only be taken in a
//          smaller format, or turned down for the rest of the year (also a
//          pass, which stops further invitations until January).
// DB TABLES: demos

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { passesLeft, passesUsed } from '@/lib/guild/demos'
import { LIMITS, SMALL_FORMATS, isFormat } from '@/lib/showtell'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: Record<string, unknown> = {}
  try { body = await request.json() } catch { /* empty body */ }

  const admin = createAdminClient()
  const { data: demo } = await admin.from('demos').select('id, user_id, kind, status').eq('id', id).maybeSingle()
  if (!demo || demo.user_id !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const now = new Date().toISOString()
  let patch: Record<string, unknown> | null = null

  if (body.action === 'withdraw' && demo.status === 'proposed') {
    patch = { status: 'cancelled' }
  } else if (demo.status === 'invited' && (body.action === 'accept' || body.action === 'pass')) {
    const left = passesLeft(await passesUsed(admin, user.id))
    if (body.action === 'accept') {
      if (!isFormat(body.format)) return NextResponse.json({ error: 'Pick a format.' }, { status: 400 })
      if (left === 0 && !SMALL_FORMATS.includes(body.format)) {
        return NextResponse.json({ error: 'Pick one of the smaller formats.' }, { status: 400 })
      }
      const title = typeof body.title === 'string' ? body.title.trim().slice(0, LIMITS.title) : ''
      patch = { status: 'confirmed', format: body.format, ...(title ? { title } : {}), responded_at: now }
    } else {
      patch = { status: 'passed', responded_at: now }
    }
  }

  if (!patch) return NextResponse.json({ error: 'That can’t be done to this one.' }, { status: 400 })
  const { error } = await admin.from('demos').update({ ...patch, updated_at: now }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
