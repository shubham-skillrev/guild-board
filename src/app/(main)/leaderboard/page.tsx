import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { HALL_OF_FLAME_THRESHOLD } from '@/lib/constants'
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

async function getLeaderboard(): Promise<{ entries: LeaderboardEntry[]; sparkWindow: SparkWindowInfo | null }> {
  // Auth gate: user must be signed in
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Use admin client to bypass RLS — users table policy only allows each user
  // to read their own row, so a regular client returns a single-row leaderboard.
  const adminDb = createAdminClient()

  const { data: users } = await adminDb
    .from('users')
    .select('id, username, spark_count, hall_of_flame')
    .limit(50)

  if (!users?.length) return { entries: [], sparkWindow: null }

  const userIds = users.map(u => u.id)

  const [{ data: topicCounts }, { data: selectedCounts }] = await Promise.all([
    adminDb
      .from('topics')
      .select('user_id')
      .in('user_id', userIds)
      .eq('is_deleted', false),
    adminDb
      .from('topics')
      .select('user_id')
      .in('user_id', userIds)
      .eq('is_selected', true)
      .eq('is_deleted', false),
  ])

  const topicMap = new Map<string, number>()
  const selectedMap = new Map<string, number>()

  topicCounts?.forEach(t => topicMap.set(t.user_id, (topicMap.get(t.user_id) ?? 0) + 1))
  selectedCounts?.forEach(s => selectedMap.set(s.user_id, (selectedMap.get(s.user_id) ?? 0) + 1))

  // Composite score: sparks × 3 + picked × 2 + ideas × 1
  const entries: LeaderboardEntry[] = users
    .map(u => {
      const topic_count = topicMap.get(u.id) ?? 0
      const selected_count = selectedMap.get(u.id) ?? 0
      return {
        ...u,
        topic_count,
        selected_count,
        guild_score: u.spark_count * 3 + selected_count * 2 + topic_count,
      }
    })
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

  return { entries, sparkWindow }
}

export default async function LeaderboardPage() {
  const { entries, sparkWindow } = await getLeaderboard()
  const hallOfFame = entries.slice(0, 3)
  const rankedList = entries.slice(3)
  const hasSparkWindow = sparkWindow !== null
  const gridCols = hasSparkWindow
    ? 'grid-cols-[3rem_1fr_4rem_4rem_4.5rem_5rem]'
    : 'grid-cols-[3rem_1fr_4rem_4rem_4.5rem]'

  return (
    <div className="px-5 md:px-10 py-8 w-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="font-serif text-2xl font-bold text-ink tracking-tight">
          Top Builders
        </h1>
        <p className="text-[13px] text-ink-soft mt-1">
          Guild legends across all cycles. Earn <span className="text-saffron font-medium">⚡ sparks</span> to reach <span className="text-saffron">Hall of Flame</span> 🔥
        </p>
        {hasSparkWindow && (
          <p className="text-[13px] text-saffron mt-2 font-medium">
            ⚡ Spark window is open — give your spark to a builder who inspired you this cycle.
          </p>
        )}
      </div>

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

      {entries.length === 0 ? (
        <div className="text-center py-24">
          <div className="text-3xl mb-3">⚡</div>
          <p className="text-base font-medium text-ink-soft">No builders yet</p>
          <p className="text-[13px] mt-1 text-cha">Start contributing to earn sparks and climb the ranks.</p>
        </div>
      ) : (
        <>
          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {rankedList.map((entry, i) => {
              const rank = i + 4
              const isSelf = sparkWindow?.currentUserId === entry.id
              const alreadyGiven = sparkWindow?.sparkedUserId === entry.id
              const isDisabled = !isSelf && sparkWindow?.sparkedUserId !== null && sparkWindow?.sparkedUserId !== entry.id
              return (
                <div key={entry.id} className="bg-paper/60 border border-border rounded-xl p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-[12px] font-semibold text-cha w-8 shrink-0">
                        {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : `#${rank}`}
                      </span>
                      <UserAvatar username={entry.username ?? 'user'} size={28} />
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium text-ink truncate">@{entry.username}</div>
                        <div className="text-[11px] text-cha">Score {entry.guild_score}</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-[12px] text-ink">⚡ {entry.spark_count}</div>
                      <div className="text-[11px] text-cha">Picked {entry.selected_count}</div>
                    </div>
                  </div>
                  {hasSparkWindow && !isSelf && (
                    <div className="mt-2 flex justify-end">
                      <SparkButton
                        toUserId={entry.id}
                        cycleId={sparkWindow!.cycleId}
                        alreadyGiven={alreadyGiven}
                        isDisabled={!!isDisabled}
                      />
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block bg-paper/50 border border-border rounded-xl overflow-x-auto">
            {/* Table header */}
            <div className={`grid ${gridCols} gap-2 px-4 py-3 border-b border-border text-[11px] font-semibold text-cha uppercase tracking-wider min-w-160`}>
              <span>#</span>
              <span>Builder</span>
              <span className="text-right">Ideas</span>
              <span className="text-right">Picked</span>
              <span className="text-right">Sparks</span>
              {hasSparkWindow && <span className="text-right">Give Spark</span>}
            </div>

            {/* Rows */}
            <div className="stagger-children min-w-160">
              {rankedList.map((entry, i) => {
                const rank = i + 4
                const isSelf = sparkWindow?.currentUserId === entry.id
                const alreadyGiven = sparkWindow?.sparkedUserId === entry.id
                const isDisabled = !isSelf && sparkWindow?.sparkedUserId !== null && sparkWindow?.sparkedUserId !== entry.id
                return (
                  <div
                    key={entry.id}
                    className={`grid ${gridCols} gap-2 px-4 py-3 items-center border-b border-border last:border-0 transition-colors hover:bg-kinu/30`}
                  >
                    <span className="text-[13px] font-semibold text-cha">#{rank}</span>

                    <div className="flex items-center gap-2.5 min-w-0">
                      <UserAvatar username={entry.username ?? 'user'} size={28} />
                      <div className="min-w-0 flex items-center gap-1.5">
                        <span className="text-[13px] font-medium text-ink truncate">@{entry.username}</span>
                        {entry.hall_of_flame && (
                          <span title="Hall of Flame" className="text-xs">🔥</span>
                        )}
                      </div>
                    </div>

                    <span className="text-[13px] text-ink-soft text-right tabular-nums">{entry.topic_count}</span>
                    <span className="text-[13px] text-ink-soft text-right tabular-nums">{entry.selected_count}</span>
                    <span className={`text-[13px] font-semibold text-right tabular-nums ${
                      entry.spark_count >= HALL_OF_FLAME_THRESHOLD ? 'text-saffron' : 'text-ink'
                    }`}>
                      ⚡ {entry.spark_count}
                    </span>

                    {hasSparkWindow && (
                      <div className="flex justify-end">
                        {isSelf ? (
                          <span className="text-cha text-[12px]">You</span>
                        ) : (
                          <SparkButton
                            toUserId={entry.id}
                            cycleId={sparkWindow!.cycleId}
                            alreadyGiven={alreadyGiven}
                            isDisabled={!!isDisabled}
                          />
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* Scoring note */}
      <p className="text-[11px] text-cha mt-4 text-center">
        Ranked by guild score: Sparks ×3 · Picked topics ×2 · Ideas ×1
      </p>
    </div>
  )
}
