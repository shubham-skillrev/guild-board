import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminId } from '@/lib/guild/staff'
import { getMeeting, openCycle } from '@/lib/guild/meeting'
import { presenterPosts } from '@/lib/guild/meetingPrep'
import { PresenterScreen } from '@/components/meet/PresenterScreen'

export const metadata: Metadata = { title: 'Presenter' }

/**
 * The presenter screen: full screen, no site chrome, admins only (404 for
 * everyone else). The admin who starts meeting mode presents; any other
 * admin gets it read-only, with "Take over". See docs/06-meeting-mode.md.
 */
export default async function PresentPage() {
  const me = await getAdminId()
  if (!me) notFound()
  const admin = createAdminClient()
  const cycle = await openCycle(admin)
  if (!cycle) {
    return <p className="m-auto p-10 text-footnote text-ink-muted">No open month, so no meeting to present.</p>
  }
  const meeting = await getMeeting(cycle.id)
  const [posts, presenter] = await Promise.all([
    presenterPosts(meeting.agenda),
    meeting.presenterId ? admin.from('users').select('username').eq('id', meeting.presenterId).maybeSingle() : null,
  ])
  return (
    <PresenterScreen
      posts={posts}
      initial={{ cycle, meeting, me, presenterName: presenter?.data?.username ?? null, serverNow: new Date().toISOString() }}
    />
  )
}
