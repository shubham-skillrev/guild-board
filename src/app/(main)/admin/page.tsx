import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { CATEGORY_LABELS, OUTCOME_LABELS } from '@/lib/constants'
import { AdminControls } from '@/components/admin/AdminControls'
import { CycleListCards } from '@/components/admin/CycleListCards'
import type { Cycle, Topic } from '@/types'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

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
    <div className="px-5 md:px-10 py-8 w-full max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-serif text-xl font-semibold text-ink">Admin Panel</h1>
          <p className="text-[13px] text-cha mt-0.5">Manage cycles, topics, and outcomes</p>
        </div>
      </div>

      {/* Interactive controls (client component) */}
      <AdminControls
        cycles={cycles as Cycle[]}
        activeCycle={activeCycle as Cycle | null}
        topics={activeCycleTopics as any[]}
      />

      {/* All cycles overview (static) */}
      <section className="mt-10">
        <h2 className="text-[11px] font-semibold text-cha uppercase tracking-wider mb-4">All Cycles</h2>
        {cycles.length === 0 ? (
          <p className="text-[13px] text-cha">No cycles created yet.</p>
        ) : (
          <CycleListCards cycles={cycles as Cycle[]} />
        )}
      </section>
    </div>
  )
}

