// ROUTE: GET /api/meet/recap?cycle_id=  -> { recap: MeetingRecap | null }
// AUTH: authenticated
// PURPOSE: "How the meeting went" on the board, above a past month's
//          discussions (components/board/MeetingRecap.tsx): who joined
//          (members / guests), poll and word-cloud highlights, the Boss
//          Round's % right per stage, the rating. Anonymous: the post-meeting
//          report's counts (lib/meet/report.ts meetingRecap), never a name.
//          Null until that month's meeting has run and ended with data.
// DB TABLES: cycles, meetings, meeting_participants, meeting_activities, meeting_responses (read only)

import { NextResponse } from 'next/server'
import { getViewer } from '@/lib/supabase/viewer'
import { loadMeetingRecap } from '@/lib/meet/reportData'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(request: Request) {
  const { user } = await getViewer()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const cycleId = new URL(request.url).searchParams.get('cycle_id') ?? ''
  if (!UUID.test(cycleId)) return NextResponse.json({ error: 'No such month' }, { status: 400 })
  const recap = await loadMeetingRecap(cycleId).catch(() => null)
  // A past month's numbers don't change: a short private cache is fine.
  return NextResponse.json({ recap }, { headers: { 'Cache-Control': 'private, max-age=300' } })
}
