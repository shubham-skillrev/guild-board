// ROUTE: GET /api/meet/live -> { live: boolean, label: string | null }
// AUTH: public (src/proxy.ts)
// PURPOSE: For the site-wide "Meeting is live, join the room" banner: whether
//          this month's meeting is live right now. One small read, polled
//          once a minute by the banner while its tab is visible. A live
//          rehearsal never counts: it doesn't set started_at, so this stays
//          false and the banner hidden (lib/meet/liveRehearsal.ts).
// DB TABLES: cycles, meetings

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { currentMeeting, isLive } from '@/lib/meet/room'

export async function GET() {
  const m = await currentMeeting(createAdminClient()).catch(() => null)
  const live = isLive(m?.row)
  return NextResponse.json({ live, label: live ? m!.cycle.label : null }, { headers: { 'Cache-Control': 'no-store' } })
}
