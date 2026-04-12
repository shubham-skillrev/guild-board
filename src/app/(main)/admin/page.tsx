import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { CATEGORY_LABELS, OUTCOME_LABELS } from '@/lib/constants'
import { AdminControls } from '@/components/admin/AdminControls'
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
  const activeCycle = cycles.find(c => c.status === 'open' || c.status === 'frozen') ?? cycles[0] ?? null
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
          <div className="space-y-2">
            {cycles.map((cycle: Cycle) => (
              <div
                key={cycle.id}
                className="flex items-center justify-between p-4 bg-paper/50 rounded-xl border border-border hover:border-border-strong transition-colors"
              >
                <div>
                  <p className="text-[14px] font-medium text-ink">{cycle.label}</p>
                  <p className="text-[12px] text-cha mt-0.5">
                    {cycle.opens_at
                      ? `Opened ${new Date(cycle.opens_at).toLocaleDateString()}`
                      : 'Not opened yet'}
                    {cycle.meeting_at && ` · Meeting ${new Date(cycle.meeting_at).toLocaleDateString()}`}
                  </p>
                </div>
                <span className={`text-[11px] font-medium px-2 py-1 rounded-full ${
                  cycle.status === 'open'
                    ? 'bg-matcha-light text-matcha'
                    : cycle.status === 'frozen'
                    ? 'bg-indigo-light text-indigo-jp'
                    : cycle.status === 'closed'
                    ? 'bg-kinu text-cha'
                    : 'bg-saffron-light text-saffron'
                }`}>
                  {cycle.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}

