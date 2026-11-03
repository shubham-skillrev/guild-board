// ROUTE: GET /api/admin/survey/image?role=<role>
// AUTH: admin only
// PURPOSE: The survey totals as one 16:9 PNG, for a meeting slide or a Slack
//          post. Counts only: no name or email is ever drawn, so it is safe to
//          share. ?role= narrows it to one role, like the dashboard filter.
// DB TABLES: survey_responses, users

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getSurveyRows } from '@/lib/surveyResults'
import { ROLES, type Role } from '@/lib/survey'
import { surveyStats } from '@/lib/surveyStats'
import { surveyImage } from '@/lib/surveyImage'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return new NextResponse(null, { status: 404 })
  const { data: me } = await createAdminClient().from('users').select('role').eq('id', user.id).maybeSingle()
  if (me?.role !== 'admin') return new NextResponse(null, { status: 404 })

  const param = new URL(request.url).searchParams.get('role')
  const role: Role | 'all' = ROLES.some(r => r.value === param) ? (param as Role) : 'all'
  const stats = surveyStats(await getSurveyRows(), role)

  const image = surveyImage(stats, role)
  image.headers.set('Content-Disposition', `attachment; filename="guild-survey${role === 'all' ? '' : `-${role}`}.png"`)
  image.headers.set('Cache-Control', 'no-store')
  return image
}

