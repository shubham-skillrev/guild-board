import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminId } from '@/lib/guild/staff'
import { serializeTopic } from '@/lib/utils/anonymity'
import { openCycle } from '@/lib/guild/demos'
import { getSurveyRows } from '@/lib/surveyResults'
import { AdminControls } from '@/components/admin/AdminControls'
import { ShowTellAdmin, type AdminDemo, type Suggestion } from '@/components/admin/ShowTellAdmin'
import { PageHeader } from '@/components/ui/Section'
import type { Cycle } from '@/types'

export const metadata: Metadata = { title: 'Topics & Show & Tell' }

/**
 * The meeting's content: which topics get discussed, and who is on for Show
 * & Tell. Anonymous topics show their ghost handle here like everywhere else.
 */
export default async function TopicsPage() {
  const adminId = await getAdminId()
  if (!adminId) notFound()
  const admin = createAdminClient()

  const { data: cyclesData } = await admin.from('cycles').select('*').order('year', { ascending: false }).order('month', { ascending: false })
  const cycles = (cyclesData ?? []) as Cycle[]
  const activeCycle = cycles.find(c => c.status === 'open') ?? cycles[0] ?? null
  const meeting = await openCycle(admin)

  const [{ data: topics }, { data: demos }, { data: members }, survey] = await Promise.all([
    activeCycle
      ? admin.from('topics').select('*, users!topics_user_id_fkey(username)').eq('cycle_id', activeCycle.id).eq('is_deleted', false).order('score', { ascending: false })
      : Promise.resolve({ data: [] }),
    admin
      .from('demos')
      .select('id, kind, status, format, title, blurb, note, cycle_id, user_id, created_at, users!demos_user_id_fkey(username), cycles(label)')
      .in('status', ['invited', 'proposed', 'confirmed', 'passed'])
      .order('created_at', { ascending: false })
      .limit(60),
    admin.from('users').select('id, username, real_name, email').eq('is_system', false).order('username'),
    getSurveyRows(),
  ])

  const byEmail = new Map((members ?? []).map(m => [(m.email ?? '').toLowerCase(), m]))
  const suggestions: Suggestion[] = [
    ...survey.filter(r => r.nominee_name).map(r => ({
      kind: 'nomination' as const,
      name: r.nominee_name,
      why: r.nominee_why || null,
      from: r.name,
      userId: null,
    })),
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
    <>
      <PageHeader title="Topics & Show & Tell" subtitle={activeCycle ? `What ${activeCycle.label} will talk about, and who is showing what.` : 'No open month.'} />
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-x-10 gap-y-(--gap-section) items-start">
        <div className="min-w-0">
          <AdminControls
            cycles={cycles}
            activeCycle={activeCycle}
            topics={(topics ?? []).map(t => serializeTopic(t, adminId))}
            show="topics"
          />
        </div>
        <ShowTellAdmin
          meeting={meeting}
          demos={rows}
          members={(members ?? []).map(m => ({ id: m.id, label: m.real_name ? `${m.real_name} (@${m.username})` : `@${m.username}` }))}
          suggestions={suggestions}
        />
      </div>
    </>
  )
}
