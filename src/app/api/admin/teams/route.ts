// ROUTE: POST /api/admin/teams
// AUTH: admin only
// PURPOSE: Teams and who is in them:
//            { action: 'create', name }
//            { action: 'lead', team_id, user_id | null }   set or clear a lead
//            { action: 'assign', user_id, team_id | null } move someone
//            { action: 'delete', team_id }                 members keep no team
// DB TABLES: teams, users

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminId } from '@/lib/guild/staff'

export async function POST(request: Request) {
  if (!(await getAdminId())) return new NextResponse(null, { status: 404 })
  let body: Record<string, unknown> = {}
  try { body = await request.json() } catch { /* empty body */ }
  const admin = createAdminClient()
  const id = (v: unknown) => (typeof v === 'string' && v ? v : null)

  let error: { message: string; code?: string } | null = null
  switch (body.action) {
    case 'create': {
      const name = typeof body.name === 'string' ? body.name.trim().slice(0, 60) : ''
      if (!name) return NextResponse.json({ error: 'Name the team.' }, { status: 400 })
      ;({ error } = await admin.from('teams').insert({ name }))
      if (error?.code === '23505') return NextResponse.json({ error: 'There is already a team with that name.' }, { status: 409 })
      break
    }
    case 'lead':
      ;({ error } = await admin.from('teams').update({ lead_id: id(body.user_id) }).eq('id', id(body.team_id) ?? ''))
      break
    case 'assign':
      ;({ error } = await admin.from('users').update({ team_id: id(body.team_id) }).eq('id', id(body.user_id) ?? ''))
      break
    case 'delete':
      ;({ error } = await admin.from('teams').delete().eq('id', id(body.team_id) ?? ''))
      break
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
