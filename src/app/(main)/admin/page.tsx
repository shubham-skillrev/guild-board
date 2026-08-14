import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { AdminControls } from '@/components/admin/AdminControls'
import { CycleListCards } from '@/components/admin/CycleListCards'
import { ByteGenerator } from '@/components/admin/ByteGenerator'
import { PageHeader, SectionHeader } from '@/components/ui/Section'
import type { Cycle } from '@/types'

async function getAdminData() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') return null

  const [{ data: cycles }, { data: allTopics }] = await Promise.all([
    supabase
      .from('cycles')
      .select('*')
      .order('year', { ascending: false })
      .order('month', { ascending: false }),
    supabase
      .from('topics')
      .select('*, users!topics_user_id_fkey(username)')
      .eq('is_deleted', false)
      .order('score', { ascending: false }),
  ])

  return { cycles: cycles ?? [], allTopics: allTopics ?? [] }
}

export default async function AdminPage() {
  const data = await getAdminData()
  if (!data) notFound()

  const { cycles, allTopics } = data
  const activeCycle = cycles.find(c => c.status === 'open') ?? cycles[0] ?? null
  const activeCycleTopics = activeCycle
    ? allTopics.filter((t: any) => t.cycle_id === activeCycle.id)
    : []

  return (
    <div className="px-(--pad-page-x) py-8 w-full max-w-(--measure-wide) mx-auto pb-28 md:pb-10">
      <PageHeader
        title="Admin"
        subtitle={
          activeCycle
            ? `${activeCycle.label} is the working cycle.`
            : 'No open cycle. Create one to get the guild rolling.'
        }
      />

      {/* Same two-column shape as the board, for the same reason: the thing you
          came here to do takes the wide column, and the things you only check
          on sit in the rail. This page used to stack four full-width sections,
          which made it the longest screen in the product. */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-x-10 gap-y-(--gap-section) items-start">
        <div className="min-w-0">
          <AdminControls
            cycles={cycles as Cycle[]}
            activeCycle={activeCycle as Cycle | null}
            topics={activeCycleTopics as any[]}
          />
        </div>

        <aside className="min-w-0 space-y-(--gap-section) lg:sticky lg:top-20">
          <ByteGenerator />

          <section aria-labelledby="admin-cycles">
            <SectionHeader id="admin-cycles" title="All cycles" hint={`${cycles.length}`} />
            {cycles.length === 0 ? (
              <p className="text-footnote text-ink-muted">No cycles created yet.</p>
            ) : (
              <CycleListCards cycles={cycles as Cycle[]} />
            )}
          </section>
        </aside>
      </div>
    </div>
  )
}

