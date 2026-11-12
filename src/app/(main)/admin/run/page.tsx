import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminId } from '@/lib/guild/staff'
import { getMeeting } from '@/lib/guild/meeting'
import { readBriefing } from '@/lib/guild/kers'
import { runBriefing } from '@/lib/guild/runBriefing'
import { KersBriefing } from '@/components/admin/pulse/KersBriefing'
import { MonthTimeline } from '@/components/admin/run/MonthTimeline'
import { AgendaBuilder } from '@/components/admin/run/AgendaBuilder'
import { RecapPanel } from '@/components/admin/run/RecapPanel'
import { Toolbox } from '@/components/admin/run/Toolbox'
import { AdminControls } from '@/components/admin/AdminControls'
import { CycleListCards } from '@/components/admin/CycleListCards'
import { ByteGenerator } from '@/components/admin/ByteGenerator'
import { BriefBackfill } from '@/components/admin/BriefBackfill'
import { SystemTopicsPanel } from '@/components/admin/SystemTopicsPanel'
import { ThemePanel } from '@/components/admin/ThemePanel'
import { AnnouncePanel } from '@/components/admin/AnnouncePanel'
import type { Cycle } from '@/types'

export const metadata: Metadata = { title: 'Run the guild' }

/**
 * Run: the month and its meeting. The timeline says where the month is; the
 * agenda is built from the board and posted to Slack; meeting mode runs the
 * hour; the recap goes out after. The rarer machinery (themes, announcements,
 * suggested topics, Bytes, months) sits in the toolbox underneath.
 */
export default async function RunPage() {
  if (!(await getAdminId())) notFound()

  const { data } = await createAdminClient()
    .from('cycles')
    .select('*')
    .order('year', { ascending: false })
    .order('month', { ascending: false })
  const cycles = (data ?? []) as Cycle[]
  const current = cycles.find(c => c.status === 'open' || c.status === 'frozen') ?? cycles.find(c => c.status !== 'upcoming') ?? cycles[0] ?? null

  const [meeting, briefing, posts] = await Promise.all([
    current ? getMeeting(current.id) : null,
    runBriefing().then(b => readBriefing('run', b.fallback)),
    // The month's posts, for linking a segment to what it's about (Kers' prep).
    current
      ? createAdminClient().from('topics').select('id, title').eq('cycle_id', current.id).eq('is_deleted', false).eq('is_system', false).order('score', { ascending: false }).limit(60).then(r => r.data ?? [])
      : [],
  ])
  // The recap belongs to the month that just met: this one once its meeting
  // has started, otherwise the last closed month (autopilot opens the next
  // month the morning after a meeting).
  const met = meeting && (meeting.startedAt || (current?.meeting_at && new Date(current.meeting_at) < new Date()))
  const lastClosed = cycles.find(c => c.status === 'closed' && c.id !== current?.id) ?? null
  const recapCycle = met ? current : lastClosed
  const recapMeeting = recapCycle ? (recapCycle.id === current?.id ? meeting : await getMeeting(recapCycle.id)) : null

  return (
    <div className="space-y-10">
      <KersBriefing scope="run" initial={briefing} />

      {current ? <MonthTimeline cycle={current} /> : <p className="text-footnote text-ink-muted">No months yet: create one in the toolbox below.</p>}

      {current && meeting && (
        <div className="grid grid-cols-1 gap-x-10 gap-y-10 lg:grid-cols-[minmax(0,1fr)_340px] items-start">
          <AgendaBuilder initial={meeting} posts={posts} />
          <aside className="min-w-0 space-y-6 lg:sticky lg:top-20">
            {recapCycle && recapMeeting && (
              <div className="rounded-[20px] border border-border bg-paper p-5">
                {recapCycle.id !== current.id && <p className="mb-2 text-meta text-ink-muted">{recapCycle.label}</p>}
                <RecapPanel key={recapCycle.id} initial={recapMeeting} />
              </div>
            )}
            {!recapCycle && (
              <p className="rounded-[20px] border border-dashed border-border-strong p-5 text-footnote text-ink-muted">
                The recap opens here once the meeting starts.
              </p>
            )}
          </aside>
        </div>
      )}

      <Toolbox
        sections={[
          { id: 'theme', title: 'Theme', hint: current?.theme ? 'This month’s theme' : 'No theme this month', body: <ThemePanel key={current?.id} cycle={current} /> },
          { id: 'announce', title: 'Announce', hint: 'Slack and push, to the whole guild', body: <AnnouncePanel /> },
          { id: 'suggest', title: 'Suggested topics', hint: 'Kers picks a few from the news', body: <SystemTopicsPanel /> },
          { id: 'bytes', title: 'Bytes', hint: 'Make a digest now, or rewrite older bytes as briefs', body: <div className="space-y-5"><BriefBackfill /><ByteGenerator /></div> },
          {
            id: 'months',
            title: 'Months',
            hint: `${cycles.length} so far · create, delete, manual status`,
            body: (
              <div className="space-y-6">
                <AdminControls cycles={cycles} activeCycle={current} topics={[]} show="cycle" />
                <CycleListCards cycles={cycles} />
              </div>
            ),
          },
        ]}
      />
    </div>
  )
}
