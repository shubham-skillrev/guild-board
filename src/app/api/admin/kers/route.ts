// ROUTE: POST /api/admin/kers  { scope: 'pulse' | 'people' | 'survey' | 'run' | 'topics' }
// AUTH: admins only (viewers read the cached briefing)
// PURPOSE: Ask Kers for a fresh briefing. A few per day per scope; the daily
//          cron writes the first one. Returns { body, byAi, refreshesLeft }.
// DB TABLES: kers_briefings (+ whatever the scope's facts read)

import { NextResponse } from 'next/server'
import { getAdminId } from '@/lib/guild/staff'
import { refreshBriefing } from '@/lib/guild/kers'
import { briefingInputs } from '@/lib/guild/briefings'

export const maxDuration = 120

export async function POST(request: Request) {
  if (!(await getAdminId())) return new NextResponse(null, { status: 404 })

  let body: { scope?: unknown } = {}
  try { body = await request.json() } catch { /* empty body */ }
  const scope = typeof body.scope === 'string' ? body.scope : ''
  const inputs = await briefingInputs(scope)
  if (!inputs) return NextResponse.json({ error: 'Unknown scope' }, { status: 400 })
  const briefing = await refreshBriefing(inputs.scope, inputs.facts, inputs.actions, inputs.fallback, true)
  return NextResponse.json(briefing)
}
