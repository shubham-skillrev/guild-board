// ROUTE: GET  /api/demos -> this month's Show & Tell (who is presenting), plus
//                           the viewer's own invitations and offers
//        POST /api/demos -> volunteer to show something { title, blurb,
//                           format, when: 'this' | 'later' }
// AUTH: GET anyone (guests see the slots); POST members
// DB TABLES: demos, cycles, users
// RLS: server client for identity; admin client for everything else (no
//      member grants on demos, see migration 040)

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { openCycle, passesLeft, passesUsed, slotsFor } from '@/lib/guild/demos'
import { LIMITS, isFormat, type MyDemo } from '@/lib/showtell'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const admin = createAdminClient()

  const cycle = await openCycle(admin)
  const slots = cycle ? await slotsFor(admin, cycle.id) : { spotlight: null, demo: null }

  let mine: MyDemo[] = []
  let passes = 0
  if (user) {
    const { data } = await admin
      .from('demos')
      .select('id, kind, status, format, title, blurb, note, cycles(label)')
      .eq('user_id', user.id)
      .in('status', ['invited', 'proposed', 'confirmed'])
      .order('created_at', { ascending: false })
    mine = (data ?? []).map(d => ({
      id: d.id, kind: d.kind, status: d.status, format: d.format, title: d.title, blurb: d.blurb, note: d.note,
      cycle_label: (d.cycles as unknown as { label: string } | null)?.label ?? null,
    }))
    if (mine.some(d => d.status === 'invited')) passes = passesLeft(await passesUsed(admin, user.id))
  }

  return NextResponse.json(
    { cycle, ...slots, mine, passes_left: passes },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to volunteer.' }, { status: 401 })

  let body: Record<string, unknown> = {}
  try { body = await request.json() } catch { /* empty body */ }
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, LIMITS.title) : ''
  const blurb = typeof body.blurb === 'string' ? body.blurb.trim().slice(0, LIMITS.blurb) : ''
  if (!title) return NextResponse.json({ error: 'Say what you would show.' }, { status: 400 })
  const format = isFormat(body.format) ? body.format : 'demo'

  const admin = createAdminClient()
  // One open offer at a time keeps the queue honest.
  const { count } = await admin
    .from('demos')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('kind', 'demo')
    .eq('status', 'proposed')
  if (count) return NextResponse.json({ error: 'You already have an offer in the queue. Change or withdraw that one first.' }, { status: 409 })

  const cycle = body.when === 'later' ? null : await openCycle(admin)
  const { data, error } = await admin
    .from('demos')
    .insert({ user_id: user.id, kind: 'demo', status: 'proposed', format, title, blurb: blurb || null, cycle_id: cycle?.id ?? null })
    .select('id')
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ id: data.id })
}
