// ROUTE: GET  /api/admin/survey  -> every answer as CSV (names and emails
//                                   included), for the organisers' follow-up
//        POST /api/admin/survey  -> { open: boolean, closes_at: ISO | null }:
//                                   the survey's open/closed switch
// AUTH: admin only
// DB TABLES: survey_responses, surveys, users
// RLS: server client for identity; admin client for reads

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSurveyRows } from '@/lib/surveyResults'
import { ATTENDED, DEMO, JOIN_REASONS, MEETING_SLOTS, ROLES, SURVEY_KEY, labelOf } from '@/lib/survey'

function cell(value: string | boolean): string {
  const s = String(value)
  // Quote everything; a leading = + - @ is neutralised so a spreadsheet never
  // runs a typed answer as a formula.
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s
  return `"${safe.replace(/"/g, '""')}"`
}

async function isAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data: me } = await createAdminClient().from('users').select('role').eq('id', user.id).maybeSingle()
  return me?.role === 'admin'
}

export async function POST(request: Request) {
  if (!(await isAdmin())) return new NextResponse(null, { status: 404 })

  let body: { open?: unknown; closes_at?: unknown } = {}
  try { body = await request.json() } catch { /* empty body */ }
  if (typeof body.open !== 'boolean') return NextResponse.json({ error: 'open must be true or false' }, { status: 400 })
  let closesAt: string | null = null
  if (typeof body.closes_at === 'string' && body.closes_at) {
    const d = new Date(body.closes_at)
    if (Number.isNaN(d.getTime())) return NextResponse.json({ error: 'closes_at is not a date' }, { status: 400 })
    closesAt = d.toISOString()
  }

  const { error } = await createAdminClient()
    .from('surveys')
    .upsert({ key: SURVEY_KEY, open: body.open, closes_at: closesAt, updated_at: new Date().toISOString() })
  if (error) {
    const missing = error.code === '42P01' || /surveys/.test(error.message)
    return NextResponse.json(
      { error: missing ? 'Apply migration 038 first: the survey switch lives there.' : error.message },
      { status: 500 },
    )
  }
  return NextResponse.json({ open: body.open, closes_at: closesAt })
}

export async function GET() {
  if (!(await isAdmin())) return new NextResponse(null, { status: 404 })

  const rows = await getSurveyRows()
  const header = [
    'Name', 'Email', 'Verified', 'Member', 'Role', 'Attended', 'Would join for', 'Other reason',
    'Learn next', 'Could demo', 'Demo idea', 'Nominee', 'Nominee why', 'Meeting slot', 'Answered at',
  ]
  const lines = rows.map(r => [
    r.name,
    r.email,
    r.verified,
    r.member,
    labelOf(ROLES, r.role),
    labelOf(ATTENDED, r.attended),
    r.join_reasons.map(v => labelOf(JOIN_REASONS, v)).join('; '),
    r.join_other,
    r.learn_next,
    labelOf(DEMO, r.demo),
    r.demo_idea,
    r.nominee_name,
    r.nominee_why,
    labelOf(MEETING_SLOTS, r.meeting_slot),
    r.updated_at,
  ].map(cell).join(','))

  return new NextResponse([header.map(cell).join(','), ...lines].join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="guild-survey-${SURVEY_KEY}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
