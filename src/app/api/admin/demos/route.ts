// ROUTE: POST /api/admin/demos
// AUTH: admin only
// PURPOSE: Run the Show & Tell queue:
//            { action: 'invite', user_id, note?, cycle_id? }  Spotlight invitation
//            { action: 'confirm', id, cycle_id }              book an offer for a meeting
//            { action: 'queue', id }                          back to "no month yet"
//            { action: 'done' | 'cancel', id }
//          An invitation pushes a notification to the invitee (if they have
//          notifications on) and shows on their board either way.
// DB TABLES: demos, users

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminId } from '@/lib/guild/staff'
import { openCycle, passesUsed } from '@/lib/guild/demos'
import { cancelDraws } from '@/lib/guild/draw'
import { LIMITS, PASSES_PER_YEAR } from '@/lib/showtell'
import { sendPushToUser } from '@/lib/push/send'

export async function POST(request: Request) {
  const adminId = await getAdminId()
  if (!adminId) return new NextResponse(null, { status: 404 })

  let body: Record<string, unknown> = {}
  try { body = await request.json() } catch { /* empty body */ }
  const admin = createAdminClient()
  const now = new Date().toISOString()
  const str = (v: unknown) => (typeof v === 'string' && v ? v : null)

  if (body.action === 'invite') {
    const userId = str(body.user_id)
    if (!userId) return NextResponse.json({ error: 'Pick someone to invite.' }, { status: 400 })
    const { data: person } = await admin.from('users').select('id, username').eq('id', userId).maybeSingle()
    if (!person) return NextResponse.json({ error: 'No such member.' }, { status: 404 })

    const { count: open } = await admin
      .from('demos').select('id', { count: 'exact', head: true })
      .eq('user_id', userId).eq('kind', 'spotlight').in('status', ['invited', 'confirmed'])
    if (open) return NextResponse.json({ error: `@${person.username} already has an open Spotlight.` }, { status: 409 })
    // Passing after the yearly passes are used means "not this year".
    if ((await passesUsed(admin, userId)) > PASSES_PER_YEAR) {
      return NextResponse.json({ error: `@${person.username} said not this year. Try again in January.` }, { status: 409 })
    }

    const cycleId = str(body.cycle_id) ?? (await openCycle(admin))?.id ?? null
    const note = str(body.note)?.trim().slice(0, LIMITS.note) ?? null
    const { error } = await admin.from('demos').insert({
      user_id: userId, kind: 'spotlight', status: 'invited', format: 'demo', note, cycle_id: cycleId, invited_by: adminId,
    })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    // A direct invitation overrides Kers' draw for the Spotlight this month.
    if (cycleId) await cancelDraws(admin, cycleId, 'spotlight').catch(() => {})

    await sendPushToUser(userId, {
      title: 'You’re invited to the Spotlight',
      body: note ? `The guild nominated you: “${note}”` : 'The guild would love to see your work. Accept or pass on your board.',
      url: '/board',
      tag: 'spotlight-invite',
    }).catch(() => {})
    return NextResponse.json({ ok: true })
  }

  const id = str(body.id)
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  let patch: Record<string, unknown>
  switch (body.action) {
    case 'confirm': {
      const cycleId = str(body.cycle_id) ?? (await openCycle(admin))?.id
      if (!cycleId) return NextResponse.json({ error: 'No open month to book it into.' }, { status: 400 })
      patch = { status: 'confirmed', cycle_id: cycleId }
      break
    }
    case 'queue': patch = { status: 'proposed', cycle_id: null }; break
    case 'done': patch = { status: 'done' }; break
    case 'cancel': patch = { status: 'cancelled' }; break
    default: return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
  const { error } = await admin.from('demos').update({ ...patch, updated_at: now }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
