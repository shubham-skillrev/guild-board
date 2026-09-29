// ROUTE: GET /api/cron/meeting-reminder
// AUTH: shared secret via Authorization: Bearer $CRON_SECRET (NOT a user session)
// PURPOSE: The day before the guild session, remind everyone (Slack + push)
//          with the board count and the three most-wanted posts.
// DB TABLES: cycles, topics, push_subscriptions
// RLS: service-role client (no user context exists here)

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rejectIfNotCron } from '@/lib/bytes/cron'
import { notifyMeetingReminder } from '@/lib/push/notify'

/* Runs once a day (vercel.json: 05:30 UTC, 11:00 IST). It sends only when the
   meeting is between 12 and 36 hours away. That window is exactly as wide as
   the gap between runs, so exactly one run per meeting lands in it, and no
   "already sent" flag has to be stored anywhere. A meeting at 11:00 IST
   Friday is reminded at 11:00 IST Thursday. */
const WINDOW_START_H = 12
const WINDOW_END_H = 36

export async function GET(request: Request) {
  const rejected = rejectIfNotCron(request)
  if (rejected) return rejected

  const admin = createAdminClient()
  const { data: cycle } = await admin
    .from('cycles')
    .select('id, meeting_at')
    .eq('status', 'open')
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!cycle?.meeting_at) {
    return NextResponse.json({ skipped: true, reason: 'no_open_cycle_with_meeting' })
  }

  const hoursAway = (new Date(cycle.meeting_at).getTime() - Date.now()) / 3_600_000
  if (hoursAway <= WINDOW_START_H || hoursAway > WINDOW_END_H) {
    return NextResponse.json({ skipped: true, reason: 'not_the_day', hoursAway: Math.round(hoursAway) })
  }

  const when = new Date(cycle.meeting_at).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata',
  })
  await notifyMeetingReminder({ cycleId: cycle.id, when })
  return NextResponse.json({ sent: true, cycleId: cycle.id })
}
