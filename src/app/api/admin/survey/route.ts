// ROUTE: GET /api/admin/survey
// AUTH: admin only
// PURPOSE: Download every answer to the guild survey as CSV (names and
//          emails included), for the organisers' own follow-up.
// DB TABLES: survey_responses, users
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

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse(null, { status: 404 })
  const { data: me } = await createAdminClient().from('users').select('role').eq('id', user.id).maybeSingle()
  if (me?.role !== 'admin') return new NextResponse(null, { status: 404 })

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
