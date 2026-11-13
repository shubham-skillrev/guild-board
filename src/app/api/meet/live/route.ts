// ROUTE: GET /api/meet/live -> { live: boolean, label: string | null, slide: string | null }
// AUTH: public (src/proxy.ts)
// PURPOSE: For the site-wide live banner and board Kers: whether this
//          month's meeting is live right now, and the slide on the shared
//          screen (its title, else its section: what every phone in the room
//          already sees). One small read, polled once a minute while a tab is
//          visible (hooks/useMeetLive.ts). A live rehearsal never counts: it
//          doesn't set started_at, so this stays false and the banner hidden
//          (lib/meet/liveRehearsal.ts).
// DB TABLES: cycles, meetings

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { currentMeeting, isLive } from '@/lib/meet/room'
import { liveSlideTitle } from '@/lib/meeting'

export async function GET() {
  const m = await currentMeeting(createAdminClient()).catch(() => null)
  const live = isLive(m?.row)
  return NextResponse.json(
    { live, label: live ? m!.cycle.label : null, slide: live ? liveSlideTitle(m!.row?.agenda, m!.row?.current_segment) : null },
    { headers: { 'Cache-Control': 'no-store' } },
  )
}
