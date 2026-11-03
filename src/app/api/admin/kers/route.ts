// ROUTE: POST /api/admin/kers  { scope: 'pulse' | 'team' | 'survey' | 'people' }
// AUTH: admins; a team lead may ask for 'team' (their own team) only
// PURPOSE: Ask Kers for a fresh briefing. A few per day per scope; the daily
//          cron writes the first one. Returns { body, byAi, refreshesLeft }.
// DB TABLES: kers_briefings (+ whatever the scope's facts read)

import { NextResponse } from 'next/server'
import { getStaff } from '@/lib/guild/staff'
import { refreshBriefing } from '@/lib/guild/kers'
import { briefingInputs } from '@/lib/guild/briefings'

export const maxDuration = 120

export async function POST(request: Request) {
  const staff = await getStaff()
  if (!staff) return new NextResponse(null, { status: 404 })

  let body: { scope?: unknown } = {}
  try { body = await request.json() } catch { /* empty body */ }
  const scope = typeof body.scope === 'string' ? body.scope : ''
  if (scope !== 'team' && !staff.isAdmin) return new NextResponse(null, { status: 404 })
  if (scope === 'team' && !staff.leadTeam) return new NextResponse(null, { status: 404 })

  const inputs = await briefingInputs(scope, staff.leadTeam?.id)
  if (!inputs) return NextResponse.json({ error: 'Unknown scope' }, { status: 400 })
  const briefing = await refreshBriefing(inputs.scope, inputs.facts, inputs.actions, inputs.fallback, true)
  return NextResponse.json(briefing)
}
