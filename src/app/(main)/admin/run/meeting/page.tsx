import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminId } from '@/lib/guild/staff'
import { getMeeting, openCycle } from '@/lib/guild/meeting'
import { MeetingMode } from '@/components/admin/run/MeetingMode'

export const metadata: Metadata = { title: 'Meeting mode' }

export default async function MeetingModePage() {
  const me = await getAdminId()
  if (!me) notFound()
  const admin = createAdminClient()
  const cycle = await openCycle(admin)
  if (!cycle) {
    return <p className="text-footnote text-ink-muted">No open month, so no meeting to run.</p>
  }
  const meeting = await getMeeting(cycle.id)
  const presenter = meeting.presenterId ? (await admin.from('users').select('username').eq('id', meeting.presenterId).maybeSingle()).data : null
  return <MeetingMode initial={{ cycle, meeting, me, presenterName: presenter?.username ?? null, serverNow: new Date().toISOString() }} />
}
