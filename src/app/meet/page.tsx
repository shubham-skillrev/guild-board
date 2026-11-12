// ROUTE: /meet (public: members and guests)
// PURPOSE: Meeting mode's room on a phone or laptop (docs/06-meeting-mode.md,
//          Phase 2). Members join under their account, guests with a typed
//          name; then the waiting area, the open activity (poll or word
//          cloud) or "Watch the screen". The site-wide banner links here
//          while the meeting is live.
// DB TABLES: cycles, meetings, meeting_participants, meeting_activities, meeting_responses

import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { MEET_COOKIE, meetView, sessionUserId } from '@/lib/meet/room'
import { MeetRoom } from '@/components/meet/MeetRoom'

export const metadata: Metadata = { title: 'The meeting room' }

export default async function MeetPage() {
  const [userId, store] = await Promise.all([sessionUserId(), cookies()])
  const view = await meetView(createAdminClient(), userId, store.get(MEET_COOKIE)?.value)
  return <MeetRoom initial={view} />
}
