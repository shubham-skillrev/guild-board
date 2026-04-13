import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { CATEGORY_LABELS } from '@/lib/constants'
import { UserAvatar } from '@/components/ui/UserAvatar'

async function getProfile() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: profile }, { data: topics }, { data: sparksReceived }] = await Promise.all([
    supabase.from('users').select('*').eq('id', user.id).single(),
    supabase
      .from('topics')
      .select('*, cycles(label, month, year, status)')
      .eq('user_id', user.id)
      .eq('is_deleted', false)
      .order('created_at', { ascending: false }),
    supabase
      .from('sparks')
      .select('*, from_user:users!sparks_from_user_id_fkey(username), cycles(label)')
      .eq('to_user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  return { profile, topics: topics ?? [], sparksReceived: sparksReceived ?? [] }
}

export default async function ProfilePage() {
  const { profile, topics, sparksReceived } = await getProfile()

  if (!profile) redirect('/login')

  return (
    <div className="px-5 md:px-10 py-8 w-full max-w-3xl mx-auto">
      {/* Header card */}
      <div className="flex items-start justify-between mb-8 pb-6 border-b border-border">
        <div className="flex items-center gap-4">
          <UserAvatar username={profile.username ?? 'user'} size={48} />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-ink">@{profile.username}</h1>
              {profile.hall_of_flame && (
                <span title="Hall of Flame" className="text-base">🔥</span>
              )}
            </div>
            <p className="text-[13px] text-cha mt-0.5">{profile.email}</p>
          </div>
        </div>
        <div className="text-right space-y-3">
          <p className="text-2xl font-bold text-ink tabular-nums">{profile.spark_count}</p>
          <p className="text-[11px] text-cha uppercase tracking-wider">sparks</p>
          <Link
            href="/board?setup=username&source=profile"
            className="inline-flex items-center justify-center px-3 py-1.5 rounded-lg border border-border bg-paper text-[12px] font-medium text-ink-soft hover:text-ink hover:border-border-strong transition-all"
          >
            Edit username
          </Link>
        </div>
      </div>

      {/* Your ideas */}
      <section className="mb-8">
        <h2 className="text-[11px] font-semibold text-cha uppercase tracking-wider mb-3">
          Your Ideas ({topics.length})
        </h2>
        {topics.length === 0 ? (
          <p className="text-[13px] text-cha">No ideas pitched yet. Head to the board and drop one!</p>
        ) : (
          <div className="space-y-2.5">
            {topics.map((topic: any) => (
              <div key={topic.id} className="p-4 bg-paper/50 rounded-xl border border-border hover:border-border-strong transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-[11px] text-cha">
                        {CATEGORY_LABELS[topic.category]}
                      </span>
                      <span className="text-[11px] text-border-strong">·</span>
                      <span className="text-[11px] text-cha">
                        {topic.cycles?.label}
                      </span>
                      {topic.is_selected && (
                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-saffron-light text-saffron">
                          ★ Selected
                        </span>
                      )}
                    </div>
                    <p className="text-[14px] font-medium text-ink">{topic.title}</p>
                  </div>
                  <div className="text-right shrink-0 text-[12px] text-cha space-y-0.5">
                    <p>▲ {topic.vote_count}</p>
                    <p>🤝 {topic.contrib_count}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Sparks received */}
      <section>
        <h2 className="text-[11px] font-semibold text-cha uppercase tracking-wider mb-3">
          Sparks Received ({sparksReceived.length})
        </h2>
        {sparksReceived.length === 0 ? (
          <p className="text-[13px] text-cha">No sparks yet — contribute to a topic to earn them!</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {sparksReceived.map((spark: any) => (
              <div
                key={spark.id}
                className="px-3 py-1.5 bg-paper/50 border border-border rounded-lg text-[13px] text-ink-soft hover:border-border-strong transition-colors"
              >
                ⚡ <span className="font-medium text-ink">@{spark.from_user?.username}</span>
                <span className="text-cha ml-1.5 text-[11px]">{spark.cycles?.label}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
