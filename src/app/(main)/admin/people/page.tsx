import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getAdminId } from '@/lib/guild/staff'
import { getPeople } from '@/lib/guild/people'
import { getNudgeLog } from '@/lib/guild/nudges'
import { peopleBriefing } from '@/lib/guild/peopleBriefing'
import { readBriefing } from '@/lib/guild/kers'
import { KersBriefing } from '@/components/admin/pulse/KersBriefing'
import { PeopleView } from '@/components/admin/people/PeopleView'
import { TeamsPanel } from '@/components/admin/people/TeamsPanel'
import { NudgeLog } from '@/components/admin/people/NudgeLog'
import { SEGMENTS, type Segment } from '@/lib/people'

export const metadata: Metadata = { title: 'People' }

type Props = { searchParams: Promise<{ segment?: string | string[] }> }

export default async function PeoplePage({ searchParams }: Props) {
  if (!(await getAdminId())) notFound()
  const raw = (await searchParams).segment
  const segment = (SEGMENTS.some(s => s.value === raw) ? raw : 'all') as Segment

  const [{ people, teams }, log] = await Promise.all([getPeople(), getNudgeLog()])
  const brief = peopleBriefing(people)
  const briefing = await readBriefing('people', brief.fallback)

  const members = people
    .filter(p => p.member && p.userId)
    .map(p => ({ id: p.userId!, label: p.username ? `${p.name} (@${p.username})` : p.name }))
  const counts: Record<string, number> = {}
  for (const p of people) if (p.teamId) counts[p.teamId] = (counts[p.teamId] ?? 0) + 1

  return (
    <div className="space-y-12">
      <KersBriefing scope="people" initial={briefing} />
      <PeopleView people={people} teams={teams} initialSegment={segment} />
      <div className="grid gap-10 lg:grid-cols-2">
        <NudgeLog rows={log} />
        <TeamsPanel teams={teams} members={members} counts={counts} />
      </div>
    </div>
  )
}
