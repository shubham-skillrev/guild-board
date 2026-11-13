// ROUTE: GET /api/admin/meeting/report[?cycle_id=]  -> { report } (lib/meet/report.ts MeetingReport)
// AUTH: admin only (404 for everyone else)
// PURPOSE: The post-meeting report as numbers: people joined (members vs
//          guests), every activity's results, the rating poll. Anonymous:
//          counts only. 409 while a live rehearsal runs. The image is
//          ./image (a PNG for Slack).
// DB TABLES: cycles, meetings, meeting_participants, meeting_activities, meeting_responses (read only)

import { NextResponse } from 'next/server'
import { getAdminId } from '@/lib/guild/staff'
import { loadMeetingReport } from '@/lib/meet/reportData'

export async function GET(request: Request) {
  if (!(await getAdminId())) return new NextResponse(null, { status: 404 })
  const r = await loadMeetingReport(new URL(request.url).searchParams.get('cycle_id'))
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  return NextResponse.json({ report: r.report }, { headers: { 'Cache-Control': 'no-store' } })
}
