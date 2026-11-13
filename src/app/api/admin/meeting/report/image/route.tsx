// ROUTE: GET /api/admin/meeting/report/image[?cycle_id=]
// AUTH: admin only (404 for everyone else)
// PURPOSE: The post-meeting report (../route.ts) as one PNG, 1200x1500, for
//          the guild's Slack channel. Counts only: no name is ever drawn.
//          409 while a live rehearsal runs.
// DB TABLES: cycles, meetings, meeting_participants, meeting_activities, meeting_responses (read only)

import { NextResponse } from 'next/server'
import { getAdminId } from '@/lib/guild/staff'
import { loadMeetingReport } from '@/lib/meet/reportData'
import { reportImage } from '@/lib/meet/reportImage'

export async function GET(request: Request) {
  if (!(await getAdminId())) return new NextResponse(null, { status: 404 })
  const r = await loadMeetingReport(new URL(request.url).searchParams.get('cycle_id'))
  if (!r.ok) return NextResponse.json({ error: r.error }, { status: r.status })
  const image = reportImage(r.report)
  const slug = r.cycle.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'meeting'
  // inline: the preview <img> shows it; the button's `download` saves it.
  image.headers.set('Content-Disposition', `inline; filename="guild-meeting-${slug}.png"`)
  image.headers.set('Cache-Control', 'no-store')
  return image
}
