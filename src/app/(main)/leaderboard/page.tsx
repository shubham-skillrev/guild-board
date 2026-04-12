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

  // Check for active spark window (closed cycle with spark_closes_at in the future)
  const { data: activeCycle } = await adminDb
    .from('cycles')
    .select('id')
    .eq('status', 'closed')
    .gt('spark_closes_at', new Date().toISOString())
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
          Guild legends across all cycles. Earn <span className="text-saffron font-medium">{HALL_OF_FLAME_THRESHOLD}+</span> sparks to reach <span className="text-saffron">Hall of Flame</span> 🔥
        </p>
        {hasSparkWindow && (
          <p className="text-[13px] text-saffron mt-2 font-medium">
            ⚡ Spark window is open — give your spark to a builder who inspired you this cycle.
          </p>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="text-center py-24">
          <div className="text-3xl mb-3">⚡</div>
          <p className="text-base font-medium text-ink-soft">No builders yet</p>
          <p className="text-[13px] mt-1 text-cha">Start contributing to earn sparks and climb the ranks.</p>
        </div>
      ) : (
        <div className="bg-paper/50 border border-border rounded-xl overflow-hidden">
          {/* Table header */}
          <div className={`grid ${gridCols} gap-2 px-4 py-3 border-b border-border text-[11px] font-semibold text-cha uppercase tracking-wider`}>
            <span>#</span>
            <span>Builder</span>
            <span className="text-right">Ideas</span>
            <span className="text-right">Picked</span>
            <span className="text-right">Sparks</span>
            {hasSparkWindow && <span className="text-right">Give Spark</span>}
          </div>

          {/* Rows */}
          <div className="stagger-children">
            {entries.map((entry, i) => {
              const rank = i + 1
              const isTop3 = rank <= 3
              const isSelf = sparkWindow?.currentUserId === entry.id
              const alreadyGiven = sparkWindow?.sparkedUserId === entry.id
              const isDisabled = !isSelf && sparkWindow?.sparkedUserId !== null && sparkWindow?.sparkedUserId !== entry.id
              return (
                <div
                  key={entry.id}
                  className={`grid ${gridCols} gap-2 px-4 py-3 items-center border-b border-border last:border-0 transition-colors hover:bg-kinu/30 ${
                    isTop3 ? 'bg-saffron-light/40' : ''
                  }`}
                >
                  {/* Rank */}
                  <span className={`text-[13px] font-semibold ${isTop3 ? 'text-saffron' : 'text-cha'}`}>
                    {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : `#${rank}`}
                  </span>

                  {/* User */}
                  <div className="flex items-center gap-2.5 min-w-0">
                    <UserAvatar username={entry.username ?? 'user'} size={28} />
                    <div className="min-w-0 flex items-center gap-1.5">
                      <span className="text-[13px] font-medium text-ink truncate">@{entry.username}</span>
                      {entry.hall_of_flame && (
                        <span title="Hall of Flame" className="text-xs">🔥</span>
                      )}
                    </div>
                  </div>

                  {/* Stats */}
                  <span className="text-[13px] text-ink-soft text-right tabular-nums">{entry.topic_count}</span>
                  <span className="text-[13px] text-ink-soft text-right tabular-nums">{entry.selected_count}</span>
                  <span className={`text-[13px] font-semibold text-right tabular-nums ${
                    entry.spark_count >= HALL_OF_FLAME_THRESHOLD ? 'text-saffron' : 'text-ink'
                  }`}>
                    ⚡ {entry.spark_count}
                  </span>

                  {/* Spark button — only shown during spark window, not for own row */}
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
      )}

      {/* Scoring note */}
      <p className="text-[11px] text-cha mt-4 text-center">
        Ranked by guild score: Sparks ×3 · Picked topics ×2 · Ideas ×1
      </p>
    </div>
  )
}
