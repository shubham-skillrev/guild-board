import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminId } from '@/lib/guild/staff'
import { getMeeting, openCycle } from '@/lib/guild/meeting'
import { presenterPosts } from '@/lib/guild/meetingPrep'
import { aggregate, type ActivityRow, type PublicActivity } from '@/lib/meet/activity'
import { PresenterScreen } from '@/components/meet/PresenterScreen'

export const metadata: Metadata = { title: 'Presenter' }

type Props = { searchParams: Promise<{ rehearse?: string | string[] }> }

/**
 * The presenter screen: full screen, no site chrome, admins only (404 for
 * everyone else). The admin who starts meeting mode presents; any other
 * admin gets it read-only, with "Take over". See docs/06-meeting-mode.md.
 *
 * `?rehearse=1` is the rehearsal: the real agenda, prep and activities, but
 * nothing live and nothing written. The activities are read here (as they
 * were seeded, with no answers); the screen fills them with sample answers.
 */
export default async function PresentPage({ searchParams }: Props) {
  const me = await getAdminId()
  if (!me) notFound()
  const rehearse = (await searchParams).rehearse === '1'
  const admin = createAdminClient()
  const cycle = await openCycle(admin)
  if (!cycle) {
    return <p className="m-auto p-10 text-footnote text-ink-muted">No open month, so no meeting to present.</p>
  }
  const meeting = await getMeeting(cycle.id)
  const [posts, presenter, activities] = await Promise.all([
    presenterPosts(meeting.agenda),
    meeting.presenterId ? admin.from('users').select('username').eq('id', meeting.presenterId).maybeSingle() : null,
    rehearse ? admin.from('meeting_activities').select('*').eq('cycle_id', cycle.id) : null,
  ])
  let rehearsal: Record<string, PublicActivity> | undefined
  if (rehearse) {
    rehearsal = {}
    for (const row of (activities?.data ?? []) as ActivityRow[]) {
      rehearsal[row.segment_id] = { ...aggregate(row, []), status: 'ready', openedAt: null, closedAt: null }
    }
  }
  return (
    <PresenterScreen
      posts={posts}
      rehearsal={rehearsal}
      initial={{ cycle, meeting, me, presenterName: presenter?.data?.username ?? null, serverNow: new Date().toISOString() }}
    />
  )
}
