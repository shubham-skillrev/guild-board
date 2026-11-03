import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminId } from '@/lib/guild/staff'
import { AdminControls } from '@/components/admin/AdminControls'
import { CycleListCards } from '@/components/admin/CycleListCards'
import { ByteGenerator } from '@/components/admin/ByteGenerator'
import { SystemTopicsPanel } from '@/components/admin/SystemTopicsPanel'
import { ThemePanel } from '@/components/admin/ThemePanel'
import { AnnouncePanel } from '@/components/admin/AnnouncePanel'
import { PageHeader, SectionHeader } from '@/components/ui/Section'
import type { Cycle } from '@/types'

export const metadata: Metadata = { title: 'Run the guild' }

/**
 * The machinery: months, themes, announcements, suggested topics and Bytes.
 * Picking topics and booking Show & Tell live on the Topics tab.
 */
export default async function RunPage() {
  if (!(await getAdminId())) notFound()

  const { data } = await createAdminClient()
    .from('cycles')
    .select('*')
    .order('year', { ascending: false })
    .order('month', { ascending: false })
  const cycles = (data ?? []) as Cycle[]
  const activeCycle = cycles.find(c => c.status === 'open') ?? cycles[0] ?? null

  return (
    <>
      <PageHeader
        title="Run the guild"
        subtitle={activeCycle ? `${activeCycle.label} is the working month.` : 'No open month. Create one to get the guild rolling.'}
      />
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-x-10 gap-y-(--gap-section) items-start">
        <div className="min-w-0">
          <AdminControls cycles={cycles} activeCycle={activeCycle} topics={[]} show="cycle" />
          <ThemePanel key={activeCycle?.id} cycle={activeCycle} />
          <AnnouncePanel />
          <SystemTopicsPanel />
        </div>
        <aside className="min-w-0 space-y-(--gap-section) lg:sticky lg:top-20">
          <ByteGenerator />
          <section aria-labelledby="admin-cycles">
            <SectionHeader id="admin-cycles" title="All months" hint={`${cycles.length}`} />
            {cycles.length === 0 ? (
              <p className="text-footnote text-ink-muted">No months created yet.</p>
            ) : (
              <CycleListCards cycles={cycles} />
            )}
          </section>
        </aside>
      </div>
    </>
  )
}
