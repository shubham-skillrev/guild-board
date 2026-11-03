// ROUTE: POST /api/admin/nudges/draft  { keys: string[] }
// AUTH: admin only
// PURPOSE: Kers' drafts of a nudge for each person (up to 25 at once), from
//          their own survey answers and named activity only. The admin edits
//          before anything is sent.
// DB TABLES: (reads) users, survey_responses, visits and activity via getPeople

import { NextResponse } from 'next/server'
import { getAdminId } from '@/lib/guild/staff'
import { getPeople } from '@/lib/guild/people'
import { draftNudges } from '@/lib/guild/nudges'

export const maxDuration = 120

export async function POST(request: Request) {
  if (!(await getAdminId())) return new NextResponse(null, { status: 404 })
  let body: { keys?: unknown } = {}
  try { body = await request.json() } catch { /* empty body */ }
  const keys = Array.isArray(body.keys) ? body.keys.filter((k): k is string => typeof k === 'string').slice(0, 25) : []
  if (!keys.length) return NextResponse.json({ error: 'Pick someone first.' }, { status: 400 })

  const { people } = await getPeople()
  const picked = people.filter(p => keys.includes(p.key) && p.canNudge)
  return NextResponse.json({ drafts: await draftNudges(picked) })
}
