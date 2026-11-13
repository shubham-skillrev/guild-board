import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminId } from '@/lib/guild/staff'
import { getMeeting, openCycle } from '@/lib/guild/meeting'
import { presenterPosts } from '@/lib/guild/meetingPrep'
import { boardPosts } from '@/lib/guild/meetingEditor'
import { aggregate, type ActivityRow, type PublicActivity } from '@/lib/meet/activity'
import { PresenterScreen } from '@/components/meet/PresenterScreen'

export const metadata: Metadata = { title: 'Presenter' }

type Props = { searchParams: Promise<{ rehearse?: string | string[]; edit?: string | string[] }> }

/**
 * The presenter screen: full screen, no site chrome, admins only (404 for
 * everyone else). The admin who starts meeting mode presents; any other
 * admin gets it read-only, with "Take over". See docs/06-meeting-mode.md.
 *
 * `?rehearse=1` is the rehearsal: the real agenda, prep and activities, but
 * nothing live and nothing written. It holds the slide editor ("Edit slides",
 * or `&edit=1` to open in it), which does write: the agenda and its
 * activities (docs/08-meeting-mode-v2.md, Batch 3). The activities are read here (as they
 * were seeded, with no answers); the screen fills them with sample answers.
 */
export default async function PresentPage({ searchParams }: Props) {
  const me = await getAdminId()
  if (!me) notFound()
  const params = await searchParams
  const rehearse = params.rehearse === '1'
  const admin = createAdminClient()
  const cycle = await openCycle(admin)
  if (!cycle) {
    return <p className="m-auto p-10 text-footnote text-ink-muted">No open month, so no meeting to present.</p>
  }
  const meeting = await getMeeting(cycle.id)
  const [posts, presenter, activities, board] = await Promise.all([
    presenterPosts(meeting.agenda),
    meeting.presenterId ? admin.from('users').select('username').eq('id', meeting.presenterId).maybeSingle() : null,
    rehearse ? admin.from('meeting_activities').select('*').eq('cycle_id', cycle.id) : null,
    // The slide editor's Topic from the board.
    rehearse ? boardPosts(cycle.id) : null,
  ])
  let rehearsal: Record<string, PublicActivity> | undefined
  if (rehearse) {
    rehearsal = {}
    for (const row of (activities?.data ?? []) as ActivityRow[]) {
      // As stored, the Boss stages' answers included: admins only, and the rehearsal hides them until a stage closes (lib/meet/rehearse.ts).
      const config = row.config && typeof row.config === 'object' && !Array.isArray(row.config) ? (row.config as Record<string, unknown>) : {}
      rehearsal[row.segment_id] = { ...aggregate(row, []), config, status: 'ready', openedAt: null, closedAt: null }
    }
  }
  return (
    <PresenterScreen
      posts={posts}
      rehearsal={rehearsal}
      board={board ? Object.values(board) : undefined}
      edit={rehearse && params.edit === '1'}
      initial={{ cycle, meeting, me, presenterName: presenter?.data?.username ?? null, serverNow: new Date().toISOString() }}
    />
  )
}
