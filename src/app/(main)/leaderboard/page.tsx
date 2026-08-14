import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { SparkButton } from '@/components/voting/SparkButton'

interface LeaderboardEntry {
  id: string
  username: string
  spark_count: number
  hall_of_flame: boolean
  topic_count: number
  selected_count: number
  guild_score: number
}

interface SparkWindowInfo {
  cycleId: string
  sparkedUserId: string | null
  currentUserId: string
}

/** Cohort stats - group framing, deliberately not per-person. */
interface CycleStats {
  label: string
  ideas: number
  voters: number
  discussed: number
}

async function getLeaderboard(): Promise<{
  entries: LeaderboardEntry[]
  sparkWindow: SparkWindowInfo | null
  members: { id: string; username: string }[]
  stats: CycleStats | null
}> {
  // Auth gate: user must be signed in
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Admin client bypasses RLS for cross-user aggregation.
  const adminDb = createAdminClient()

  const { data: users } = await adminDb
    .from('users')
    .select('id, username, spark_count, hall_of_flame')
    .limit(100)

  const empty = { entries: [], sparkWindow: null, members: [], stats: null }
  if (!users?.length) return empty

  const members = users
    .map(u => ({ id: u.id, username: u.username }))
    .sort((a, b) => (a.username ?? '').localeCompare(b.username ?? ''))

  // Scope to the most recent non-upcoming cycle. All-time ranking is
  // deliberately gone: with ~30 members and <10 active, a permanent ordinal
  // list mostly publishes who is inactive. Per-cycle means a quiet month
  // leaves no lasting record and a newcomer can place in their first month.
  const { data: scopedCycle } = await adminDb
    .from('cycles')
    .select('id, label')
    .neq('status', 'upcoming')
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!scopedCycle) return { ...empty, members }

  const [{ data: cycleTopics }, { data: cycleSparks }, { data: cycleVotes }] = await Promise.all([
    adminDb
      .from('topics')
      .select('user_id, is_selected, is_anonymous, outcome_tag')
      .eq('cycle_id', scopedCycle.id)
      .eq('is_deleted', false),
    adminDb
      .from('sparks')
      .select('to_user_id')
      .eq('cycle_id', scopedCycle.id),
    adminDb
      .from('votes')
      .select('user_id')
      .eq('cycle_id', scopedCycle.id),
  ])

  const topicMap = new Map<string, number>()
  const selectedMap = new Map<string, number>()
  const sparkMap = new Map<string, number>()

  // Ghost pitches are excluded from scoring - crediting them would let the
  // board reveal, by arithmetic, who authored an anonymous topic.
  cycleTopics?.forEach(t => {
    if (t.is_anonymous) return
    topicMap.set(t.user_id, (topicMap.get(t.user_id) ?? 0) + 1)
    if (t.is_selected) selectedMap.set(t.user_id, (selectedMap.get(t.user_id) ?? 0) + 1)
  })
  cycleSparks?.forEach(s => sparkMap.set(s.to_user_id, (sparkMap.get(s.to_user_id) ?? 0) + 1))

  const stats: CycleStats = {
    label: scopedCycle.label,
    ideas: cycleTopics?.length ?? 0,
    voters: new Set((cycleVotes ?? []).map(v => v.user_id)).size,
    discussed: (cycleTopics ?? []).filter(t => t.outcome_tag && t.outcome_tag !== 'dropped').length,
  }

  // Composite score: sparks × 3 + picked × 2 + ideas × 1 - this cycle only.
  const entries: LeaderboardEntry[] = users
    .map(u => {
      const topic_count = topicMap.get(u.id) ?? 0
      const selected_count = selectedMap.get(u.id) ?? 0
      const spark_count = sparkMap.get(u.id) ?? 0
      return {
        ...u,
        spark_count,
        topic_count,
        selected_count,
        guild_score: spark_count * 3 + selected_count * 2 + topic_count,
      }
    })
    // Only people who actually did something place. A score of 0 never ranks.
    .filter(e => e.guild_score > 0)
    .sort((a, b) => b.guild_score - a.guild_score)

  // Check for active spark window:
  // 1. Open cycle after meeting date, OR
  // 2. Closed cycle still within spark_closes_at window
  const now = new Date().toISOString()
  const { data: activeCycle } = await adminDb
    .from('cycles')
    .select('id')
    .or(`and(status.eq.open,meeting_at.lte.${now}),and(status.eq.closed,spark_closes_at.gt.${now})`)
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(1)
    .maybeSingle()

  let sparkWindow: SparkWindowInfo | null = null
  if (activeCycle) {
    const { data: existingSpark } = await supabase
      .from('sparks')
      .select('to_user_id')
      .eq('from_user_id', user.id)
      .eq('cycle_id', activeCycle.id)
      .maybeSingle()

    sparkWindow = {
      cycleId: activeCycle.id,
      sparkedUserId: existingSpark?.to_user_id ?? null,
      currentUserId: user.id,
    }
  }

  return { entries, sparkWindow, members, stats }
}

export default async function LeaderboardPage() {
  const { entries, sparkWindow, members, stats } = await getLeaderboard()
  // Top 3 only. Ranks 4-N are intentionally not rendered - see getLeaderboard.
  const hallOfFame = entries.slice(0, 3)
  const hasSparkWindow = sparkWindow !== null
  // Everyone is sparkable during the window, not just the podium. Unranked
  // and alphabetical so recognition never doubles as a standings table.
  const sparkables = members.filter(m => m.id !== sparkWindow?.currentUserId)

  return (
    <div className="px-5 md:px-10 py-8 w-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-bold text-ink tracking-tight">
          Top Builders
        </h1>
        <p className="text-[13px] text-ink-soft mt-1">
          {stats ? `${stats.label} · resets every cycle.` : 'Resets every cycle.'} Earn <span className="text-saffron font-medium">⚡ sparks</span> to reach <span className="text-saffron">Hall of Flame</span> 🔥
        </p>
        {hasSparkWindow && (
          <p className="text-[13px] text-saffron mt-2 font-medium">
            ⚡ Spark window is open - give your spark to a builder who inspired you this cycle.
          </p>
        )}
      </div>

      {/* Cohort stats - what the guild did together, with nobody ranked. */}
      {stats && (
        <section className="mb-8 grid grid-cols-3 gap-3">
          {[
            { label: 'Ideas pitched', value: stats.ideas, icon: '💡' },
            { label: 'People voted', value: stats.voters, icon: '🗳️' },
            { label: 'Taken forward', value: stats.discussed, icon: '✅' },
          ].map(stat => (
            <div key={stat.label} className="bg-paper/50 border border-border rounded-xl px-3 py-3.5 text-center">
              <div className="text-base mb-1">{stat.icon}</div>
              <div className="text-[20px] font-semibold text-ink tabular-nums leading-none">{stat.value}</div>
              <div className="text-[11px] text-cha mt-1.5">{stat.label}</div>
            </div>
          ))}
        </section>
      )}

      {hallOfFame.length > 0 && (
        <section className="mb-8 rounded-[1.75rem] border border-saffron/20 bg-linear-to-br from-saffron-light/30 via-paper/90 to-wisteria-light/25 p-5 md:p-6 shadow-[0_24px_70px_rgba(0,0,0,0.28)] overflow-hidden">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-serif text-xl md:text-2xl text-ink">Hall of Fame</h2>
              <p className="text-[12px] text-ink-soft mt-1">The most celebrated builders in the guild.</p>
            </div>
            <span className="text-[11px] font-semibold tracking-[0.24em] uppercase text-saffron/80">Top 3</span>
          </div>

          <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr_1fr] items-end">
            {hallOfFame[1] && (
              <div className="order-2 lg:order-1 rounded-2xl border border-border bg-paper/75 p-4 shadow-[0_16px_32px_rgba(0,0,0,0.18)]">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-2xl">🥈</span>
                  <span className="text-[10px] uppercase tracking-widest text-cha">Runner-up</span>
                </div>
                <div className="flex items-center gap-3">
                  <UserAvatar username={hallOfFame[1].username ?? 'user'} size={40} />
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium text-ink truncate">@{hallOfFame[1].username}</p>
                    <p className="text-[12px] text-ink-soft">Score {hallOfFame[1].guild_score}</p>
                  </div>
                </div>
                {hasSparkWindow && sparkWindow!.currentUserId !== hallOfFame[1].id && (
                  <div className="mt-3 flex justify-end">
                    <SparkButton
                      toUserId={hallOfFame[1].id}
                      cycleId={sparkWindow!.cycleId}
                      alreadyGiven={sparkWindow!.sparkedUserId === hallOfFame[1].id}
                      isDisabled={sparkWindow!.sparkedUserId !== null && sparkWindow!.sparkedUserId !== hallOfFame[1].id}
                    />
                  </div>
                )}
              </div>
            )}

            {hallOfFame[0] && (
              <div className="order-1 lg:order-2 rounded-[1.75rem] border border-saffron/25 bg-linear-to-b from-saffron-light/50 to-paper/90 p-5 md:p-6 shadow-[0_22px_50px_rgba(232,145,58,0.12)] relative">
                <div className="absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-saffron/50 to-transparent" />
                <div className="flex items-center justify-between mb-4">
                  <span className="text-3xl">🥇</span>
                  <span className="text-[10px] uppercase tracking-widest text-saffron">Champion</span>
                </div>
                <div className="flex flex-col items-center text-center gap-3">
                  <UserAvatar username={hallOfFame[0].username ?? 'user'} size={64} />
                  <div>
                    <p className="text-[17px] font-semibold text-ink">@{hallOfFame[0].username}</p>
                    <p className="text-[12px] text-ink-soft">Guild score {hallOfFame[0].guild_score}</p>
                  </div>
                  <div className="flex items-center gap-3 text-[12px] text-cha">
                    <span>⚡ {hallOfFame[0].spark_count}</span>
                    <span>•</span>
                    <span>Ideas {hallOfFame[0].topic_count}</span>
                  </div>
                  {hasSparkWindow && (
                    sparkWindow!.currentUserId === hallOfFame[0].id
                      ? <span className="text-[12px] text-saffron/60 font-medium">✨ That&apos;s you!</span>
                      : <SparkButton
                          toUserId={hallOfFame[0].id}
                          cycleId={sparkWindow!.cycleId}
                          alreadyGiven={sparkWindow!.sparkedUserId === hallOfFame[0].id}
                          isDisabled={sparkWindow!.sparkedUserId !== null && sparkWindow!.sparkedUserId !== hallOfFame[0].id}
                        />
                  )}
                </div>
              </div>
            )}

            {hallOfFame[2] && (
              <div className="order-3 rounded-2xl border border-border bg-paper/75 p-4 shadow-[0_16px_32px_rgba(0,0,0,0.18)]">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-2xl">🥉</span>
                  <span className="text-[10px] uppercase tracking-widest text-cha">Podium</span>
                </div>
                <div className="flex items-center gap-3">
                  <UserAvatar username={hallOfFame[2].username ?? 'user'} size={40} />
                  <div className="min-w-0">
                    <p className="text-[15px] font-medium text-ink truncate">@{hallOfFame[2].username}</p>
                    <p className="text-[12px] text-ink-soft">Score {hallOfFame[2].guild_score}</p>
                  </div>
                </div>
                {hasSparkWindow && sparkWindow!.currentUserId !== hallOfFame[2].id && (
                  <div className="mt-3 flex justify-end">
                    <SparkButton
                      toUserId={hallOfFame[2].id}
                      cycleId={sparkWindow!.cycleId}
                      alreadyGiven={sparkWindow!.sparkedUserId === hallOfFame[2].id}
                      isDisabled={sparkWindow!.sparkedUserId !== null && sparkWindow!.sparkedUserId !== hallOfFame[2].id}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      )}

      {entries.length === 0 && (
        <div className="text-center py-16">
          <div className="text-3xl mb-3">⚡</div>
          <p className="text-base font-medium text-ink-soft">Nothing on the board yet this cycle</p>
          <p className="text-[13px] mt-1 text-cha">Pitch an idea or raise a hand - it counts from the first one.</p>
        </div>
      )}

      {/* Spark picker - every member, unranked and alphabetical. Recognition
          should not require appearing in a standings table. */}
      {hasSparkWindow && sparkables.length > 0 && (
        <section className="bg-paper/50 border border-border rounded-xl p-4 md:p-5">
          <div className="mb-4">
            <h2 className="text-[15px] font-semibold text-ink">Give your spark</h2>
            <p className="text-[12px] text-cha mt-0.5">
              One per cycle, to anyone who made this month better. Listed A–Z, not ranked.
            </p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2 stagger-children">
            {sparkables.map(member => {
              const alreadyGiven = sparkWindow!.sparkedUserId === member.id
              const isDisabled = sparkWindow!.sparkedUserId !== null && !alreadyGiven
              return (
                <div
                  key={member.id}
                  className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 transition-colors ${
                    alreadyGiven ? 'border-saffron/30 bg-saffron-light/20' : 'border-border hover:bg-kinu/30'
                  }`}
                >
                  <UserAvatar username={member.username ?? 'user'} size={28} />
                  <span className="text-[13px] font-medium text-ink truncate min-w-0">@{member.username}</span>
                  <span className="ml-auto shrink-0">
                    <SparkButton
                      toUserId={member.id}
                      cycleId={sparkWindow!.cycleId}
                      alreadyGiven={alreadyGiven}
                      isDisabled={isDisabled}
                    />
                  </span>
                </div>
              )
            })}
          </div>
        </section>
      )}


      {/* Scoring note */}
      <p className="text-[11px] text-cha mt-6 text-center leading-relaxed">
        Top 3 this cycle by guild score: Sparks ×3 · Picked topics ×2 · Ideas ×1.
        <br />
        Resets each cycle - no all-time ranking, and ghost pitches are never scored.
      </p>
    </div>
  )
}
