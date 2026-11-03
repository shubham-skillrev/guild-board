import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminId } from '@/lib/guild/staff'
import { serializeTopic } from '@/lib/utils/anonymity'
import { openCycle } from '@/lib/guild/demos'
import { getSurveyRows } from '@/lib/surveyResults'
import { readBriefing } from '@/lib/guild/kers'
import { topicsBriefing } from '@/lib/guild/runBriefing'
import { KersBriefing } from '@/components/admin/pulse/KersBriefing'
import { PipelineBoard, type PipelineTopic } from '@/components/admin/topics/PipelineBoard'
import { ShowTellAdmin, type AdminDemo, type Suggestion } from '@/components/admin/ShowTellAdmin'
import { SectionHeader } from '@/components/ui/Section'

export const metadata: Metadata = { title: 'Topics & Show & Tell' }

/**
 * The meeting's content: this month's topics as a pipeline (board → picked
 * → what came of it), and Show & Tell bookings. Anonymous topics show their
 * ghost handle here like everywhere else.
 */
export default async function TopicsPage() {
  const adminId = await getAdminId()
  if (!adminId) notFound()
  const admin = createAdminClient()

  const { data: cyclesData } = await admin.from('cycles').select('id, label, status').order('year', { ascending: false }).order('month', { ascending: false })
  const cycles = cyclesData ?? []
  const month = cycles.find(c => c.status === 'open' || c.status === 'frozen') ?? cycles.find(c => c.status !== 'upcoming') ?? null
  const meeting = await openCycle(admin)

  const [{ data: topics }, { data: demos }, { data: members }, survey, briefing] = await Promise.all([
    month
      ? admin.from('topics').select('*, users!topics_user_id_fkey(username)').eq('cycle_id', month.id).eq('is_deleted', false).eq('is_system', false).order('score', { ascending: false })
      : Promise.resolve({ data: [] }),
    admin
      .from('demos')
      .select('id, kind, status, format, title, blurb, note, cycle_id, user_id, created_at, users!demos_user_id_fkey(username), cycles(label)')
      .in('status', ['invited', 'proposed', 'confirmed', 'passed'])
      .order('created_at', { ascending: false })
      .limit(60),
    admin.from('users').select('id, username, real_name, email').eq('is_system', false).order('username'),
    getSurveyRows(),
    topicsBriefing().then(b => readBriefing('topics', b.fallback)),
  ])

  const serialized = (topics ?? []).map(t => serializeTopic(t, adminId))
  const { data: signals } = serialized.length
    ? await admin.from('topic_signals').select('topic_id').in('topic_id', serialized.map(t => t.id))
    : { data: [] as { topic_id: string }[] }
  const signalCount = new Map<string, number>()
  for (const s of signals ?? []) signalCount.set(s.topic_id, (signalCount.get(s.topic_id) ?? 0) + 1)

  const pipeline: PipelineTopic[] = serialized.map(t => ({
    id: t.id,
    title: t.title,
    category: t.category ?? null,
    by: t.author_username ? `@${t.author_username}` : 'GuildBot',
    votes: t.vote_count ?? 0,
    comments: t.comment_count ?? 0,
    signals: signalCount.get(t.id) ?? 0,
    selected: !!t.is_selected,
    outcome: t.outcome_tag ?? null,
    outcomeNote: t.outcome_note ?? null,
  }))

  const byEmail = new Map((members ?? []).map(m => [(m.email ?? '').toLowerCase(), m]))
  const suggestions: Suggestion[] = [
    ...survey.filter(r => r.nominee_name).map(r => ({ kind: 'nomination' as const, name: r.nominee_name, why: r.nominee_why || null, from: r.name, userId: null })),
    ...survey.filter(r => r.demo === 'yes' || r.demo === 'maybe').map(r => ({
      kind: 'volunteer' as const,
      name: r.name,
      why: r.demo_idea || (r.demo === 'maybe' ? 'Said maybe, with some help' : 'Said yes'),
      from: null,
      userId: byEmail.get(r.email)?.id ?? null,
    })),
  ]
  const rows: AdminDemo[] = (demos ?? []).map(d => ({
    id: d.id, kind: d.kind, status: d.status, format: d.format, title: d.title, blurb: d.blurb, note: d.note,
    cycleId: d.cycle_id,
    cycleLabel: (d.cycles as unknown as { label: string } | null)?.label ?? null,
    username: (d.users as unknown as { username: string } | null)?.username ?? '?',
  }))

  return (
    <div className="space-y-12">
      <KersBriefing scope="topics" initial={briefing} />

      <section aria-labelledby="topics-pipeline">
        <SectionHeader id="topics-pipeline" title={month ? `${month.label} topics` : 'Topics'} hint="Drag a card to move it, or use “Move to”. Ranked by votes in each column." />
        <PipelineBoard topics={pipeline} />
      </section>

      <ShowTellAdmin
        meeting={meeting}
        demos={rows}
        members={(members ?? []).map(m => ({ id: m.id, label: m.real_name ? `${m.real_name} (@${m.username})` : `@${m.username}` }))}
        suggestions={suggestions}
      />
    </div>
  )
}
