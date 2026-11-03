// ROUTE: GET  /api/radar -> this month's Radar: links members put forward and
//                           this month's Bytes people want to discuss, by votes
//        POST /api/radar -> put a link forward { url, title, note? }
// AUTH: GET anyone (guests read); POST members, three links a month each
// DB TABLES: radar_links, radar_votes, bytes, byte_digests, byte_interests, cycles
// RLS: server client for identity; admin client for reads and writes (no
//      member grants on radar tables, migration 040). Guests and members get
//      the same rows; only published digests' bytes are ever included.

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { openCycle } from '@/lib/guild/demos'
import { RADAR_LIMITS, type RadarItem } from '@/lib/radar'

function domainOf(url: string): string {
  try { return new URL(url).hostname.replace(/^www\./, '') } catch { return '' }
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const admin = createAdminClient()
  const cycle = await openCycle(admin)
  if (!cycle) return NextResponse.json({ cycle: null, items: [] })

  const { data: c } = await admin.from('cycles').select('opens_at, created_at').eq('id', cycle.id).maybeSingle()
  const since = c?.opens_at ?? c?.created_at ?? new Date(Date.now() - 31 * 86_400_000).toISOString()

  const [{ data: links }, { data: bytes }] = await Promise.all([
    admin
      .from('radar_links')
      .select('id, url, title, note, vote_count, user_id, created_at, users!radar_links_user_id_fkey(username)')
      .eq('cycle_id', cycle.id)
      .eq('is_deleted', false)
      .order('vote_count', { ascending: false })
      .limit(30),
    admin
      .from('bytes')
      .select('id, source_title, source_name, url, summary, interest_count, created_at, byte_digests!inner(status)')
      .eq('byte_digests.status', 'published')
      .gte('created_at', since)
      .gt('interest_count', 0)
      .order('interest_count', { ascending: false })
      .limit(20),
  ])

  let votedLinks = new Set<string>()
  let votedBytes = new Set<string>()
  if (user) {
    const [{ data: lv }, { data: bv }] = await Promise.all([
      admin.from('radar_votes').select('link_id').eq('user_id', user.id).in('link_id', (links ?? []).map(l => l.id)),
      admin.from('byte_interests').select('byte_id').eq('user_id', user.id).in('byte_id', (bytes ?? []).map(b => b.id)),
    ])
    votedLinks = new Set((lv ?? []).map(v => v.link_id))
    votedBytes = new Set((bv ?? []).map(v => v.byte_id))
  }

  const items: (RadarItem & { at: string })[] = [
    ...(links ?? []).map(l => ({
      kind: 'link' as const,
      id: l.id,
      title: l.title,
      href: l.url,
      source: domainOf(l.url),
      note: l.note,
      by: (l.users as unknown as { username: string } | null)?.username ?? null,
      votes: l.vote_count,
      voted: votedLinks.has(l.id),
      mine: l.user_id === user?.id,
      at: l.created_at,
    })),
    ...(bytes ?? []).map(b => ({
      kind: 'byte' as const,
      id: b.id,
      title: b.source_title,
      href: `/bytes/${b.id}`,
      source: b.source_name || domainOf(b.url),
      note: b.summary ? b.summary.slice(0, 160) : null,
      by: null,
      votes: b.interest_count,
      voted: votedBytes.has(b.id),
      mine: false,
      at: b.created_at,
    })),
  ]
  items.sort((a, b) => b.votes - a.votes || b.at.localeCompare(a.at))

  return NextResponse.json(
    { cycle, items: items.slice(0, 15).map(({ at: _at, ...i }) => i) },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Sign in to add a link.' }, { status: 401 })

  let body: Record<string, unknown> = {}
  try { body = await request.json() } catch { /* empty body */ }
  const title = typeof body.title === 'string' ? body.title.trim().slice(0, RADAR_LIMITS.title) : ''
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, RADAR_LIMITS.note) : ''
  let url: URL | null = null
  try { url = new URL(String(body.url ?? '').trim()) } catch { /* invalid */ }
  if (!url || url.protocol !== 'https:' || url.href.length > RADAR_LIMITS.url) {
    return NextResponse.json({ error: 'Paste a full https:// link.' }, { status: 400 })
  }
  if (!title) return NextResponse.json({ error: 'Give it a title.' }, { status: 400 })

  const admin = createAdminClient()
  const cycle = await openCycle(admin)
  if (!cycle) return NextResponse.json({ error: 'No month is open right now.' }, { status: 400 })

  const { count } = await admin
    .from('radar_links').select('id', { count: 'exact', head: true })
    .eq('cycle_id', cycle.id).eq('user_id', user.id).eq('is_deleted', false)
  if ((count ?? 0) >= RADAR_LIMITS.perPerson) {
    return NextResponse.json({ error: `Three links a month each. Vote on the others instead.` }, { status: 409 })
  }

  url.hash = ''
  const { data, error } = await admin
    .from('radar_links')
    .insert({ cycle_id: cycle.id, user_id: user.id, url: url.toString(), title, note: note || null })
    .select('id')
    .single()
  if (error) {
    if (error.code === '23505') return NextResponse.json({ error: 'Someone already put that link forward. Vote for it instead.' }, { status: 409 })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  // Your own link starts with your vote.
  await admin.from('radar_votes').insert({ link_id: data.id, user_id: user.id })
  return NextResponse.json({ id: data.id })
}
