import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getStaff } from '@/lib/guild/staff'
import { getPeople } from '@/lib/guild/people'
import { getNudgeLog } from '@/lib/guild/nudges'
import { peopleBriefing } from '@/lib/guild/peopleBriefing'
import { readBriefing } from '@/lib/guild/kers'
import { KersBriefing } from '@/components/admin/pulse/KersBriefing'
import { PeopleView } from '@/components/admin/people/PeopleView'
import { NudgeLog } from '@/components/admin/people/NudgeLog'
import { MembersGrowth } from '@/components/admin/people/MembersGrowth'
import { getGrowth, COMPANY_SIZE } from '@/lib/guild/growth'
import { SEGMENTS, type Segment } from '@/lib/people'

export const metadata: Metadata = { title: 'People' }

type Props = { searchParams: Promise<{ segment?: string | string[]; pick?: string | string[] }> }

export default async function PeoplePage({ searchParams }: Props) {
  const staff = await getStaff()
  if (!staff) notFound()
  const params = await searchParams
  const raw = params.segment
  const pick = typeof params.pick === 'string' ? params.pick : null
  const segment = (SEGMENTS.some(s => s.value === raw) ? raw : 'all') as Segment

  const [{ people }, log, growth] = await Promise.all([getPeople(), getNudgeLog(), getGrowth()])
  const brief = peopleBriefing(people)
  const briefing = await readBriefing('people', brief.fallback)

  return (
    <div className="space-y-12">
      <KersBriefing scope="people" initial={briefing} readOnly={staff.readOnly} />
      <MembersGrowth growth={growth} companySize={COMPANY_SIZE} readOnly={staff.readOnly} />
      <div id="people-hall" className="scroll-mt-24">
        <PeopleView people={people} readOnly={staff.readOnly} initialSegment={segment} initialPick={pick} />
      </div>
      {!staff.readOnly && <NudgeLog rows={log} />}
    </div>
  )
}
