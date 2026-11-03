import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminId } from '@/lib/guild/staff'
import { getMeeting, openCycle } from '@/lib/guild/meeting'
import { MeetingMode } from '@/components/admin/run/MeetingMode'

export const metadata: Metadata = { title: 'Meeting mode' }

export default async function MeetingModePage() {
  if (!(await getAdminId())) notFound()
  const cycle = await openCycle(createAdminClient())
  if (!cycle) {
    return <p className="text-footnote text-ink-muted">No open month, so no meeting to run.</p>
  }
  return <MeetingMode label={cycle.label} initial={await getMeeting(cycle.id)} />
}
