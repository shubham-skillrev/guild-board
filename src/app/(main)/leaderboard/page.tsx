import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Lightbulb, Users, CheckCircle } from '@phosphor-icons/react/dist/ssr'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { SparkButton } from '@/components/voting/SparkButton'
import { StatStrip, StatChip } from '@/components/ui/Section'

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

  // The most recent non-upcoming cycle. Used only to label and compute the
  // cohort stats strip; the standings themselves run across all cycles.
  const { data: scopedCycle } = await adminDb
    .from('cycles')
    .select('id, label')
    .neq('status', 'upcoming')
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!scopedCycle) return { ...empty, members }

  /* Standings run across all cycles. Ranking was scoped to the current cycle,
     which meant that early in a month almost nobody had scored yet and the
     board showed a podium with nothing under it. Contribution to a guild is
     cumulative, and a table that resets to empty every month cannot show it.
     The cohort stats below stay per-cycle: those describe the month, not the
     person, and that is the distinction the two are making.
     Tradeoff accepted knowingly: a permanent ordinal list also records who is
     inactive. Sparks stay per-cycle-giveable so newcomers can still move. */
  const [{ data: allTopics }, { data: allSparks }] = await Promise.all([
    adminDb
      .from('topics')
      .select('user_id, is_selected, is_anonymous')
      .eq('is_deleted', false),
    adminDb.from('sparks').select('to_user_id'),
  ])

  const [{ data: cycleTopics }, { data: cycleVotes }] = await Promise.all([
    adminDb
      .from('topics')
      .select('user_id, outcome_tag')
      .eq('cycle_id', scopedCycle.id)
      .eq('is_deleted', false),
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
  allTopics?.forEach(t => {
    if (t.is_anonymous) return
    topicMap.set(t.user_id, (topicMap.get(t.user_id) ?? 0) + 1)
    if (t.is_selected) selectedMap.set(t.user_id, (selectedMap.get(t.user_id) ?? 0) + 1)
  })
  allSparks?.forEach(s => sparkMap.set(s.to_user_id, (sparkMap.get(s.to_user_id) ?? 0) + 1))

  const stats: CycleStats = {
    label: scopedCycle.label,
    ideas: cycleTopics?.length ?? 0,
    voters: new Set((cycleVotes ?? []).map(v => v.user_id)).size,
    discussed: (cycleTopics ?? []).filter(t => t.outcome_tag && t.outcome_tag !== 'dropped').length,
  }

  // Composite score: sparks × 3 + picked × 2 + ideas × 1, across all cycles.
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
  // The podium. Ranks 4-N follow in the standings table below.
  const hallOfFame = entries.slice(0, 3)
  const hasSparkWindow = sparkWindow !== null
  // Ranks 4 and below. These were computed and then dropped, which left the
  // page with a podium and nothing under it.
  const rest = entries.slice(3)
  // Everyone is sparkable during the window, not just people who placed. The
  // picker lists only those NOT already in the table above, so no member gets
  // two spark buttons on one screen.
  const rankedIds = new Set(entries.map(e => e.id))
  const unranked = members.filter(
    m => m.id !== sparkWindow?.currentUserId && !rankedIds.has(m.id),
  )

  return (
    <div className="px-5 md:px-10 py-8 w-full max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="type-display font-serif text-ink">
          Top Builders
        </h1>
        <p className="type-body text-ink-soft mt-1.5">
          Guild legends across all cycles. Earn <span className="text-saffron font-medium">sparks</span> to reach the Hall of Flame.
        </p>
        {hasSparkWindow && (
          <p className="text-[13px] text-saffron mt-2 font-medium">
            ⚡ Spark window is open - give your spark to a builder who inspired you this cycle.
          </p>
        )}
      </div>

      {/* Cohort stats - what the guild did together, with nobody ranked.
          Same strip the board uses for your quotas. */}
      {stats && (
        <StatStrip className="mb-8">
          {[
            { label: 'ideas pitched', value: stats.ideas, icon: Lightbulb },
            { label: 'people voted', value: stats.voters, icon: Users },
            { label: 'taken forward', value: stats.discussed, icon: CheckCircle },
          ].map(stat => (
            <StatChip key={stat.label} icon={stat.icon} value={stat.value} label={stat.label} />
          ))}
        </StatStrip>
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
              <div className="order-2 lg:order-1 rounded-(--radius-card) border border-border bg-paper/75 p-(--pad-card)">
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
              <div className="order-3 rounded-(--radius-card) border border-border bg-paper/75 p-(--pad-card)">
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

      {/* ─── Standings ───
          Ranks 4 and below were being computed and then thrown away, so the
          page went straight from a podium to nothing. A table restores the
          density the podium alone cannot carry, and a column of aligned
          numbers is the whole reason a standings table beats a card grid.
          Everyone who scored appears. Nobody who scored zero is listed as
          zero, which was the original objection and still holds. */}
      {rest.length > 0 && (
        <section className="mb-8 rounded-(--radius-card) border border-border bg-paper/40 overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-border text-meta text-ink-muted uppercase">
                <th scope="col" className="font-medium py-2.5 pl-4 pr-2 w-12">#</th>
                <th scope="col" className="font-medium py-2.5 px-2">Builder</th>
                <th scope="col" className="font-medium py-2.5 px-2 text-right tabular">Ideas</th>
                <th scope="col" className="font-medium py-2.5 px-2 text-right tabular hidden sm:table-cell">Picked</th>
                <th scope="col" className="font-medium py-2.5 px-2 text-right tabular">Sparks</th>
                {hasSparkWindow && (
                  <th scope="col" className="font-medium py-2.5 pl-2 pr-4 text-right">Give</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rest.map((entry, i) => (
                <tr key={entry.id} className="hover:bg-kinu/25 transition-colors">
                  <td className="py-2.5 pl-4 pr-2 text-footnote text-ink-muted tabular">
                    {i + 4}
                  </td>
                  <td className="py-2.5 px-2">
                    <span className="flex items-center gap-2.5 min-w-0">
                      <UserAvatar username={entry.username ?? 'user'} size={26} />
                      <span className="text-footnote text-ink truncate">@{entry.username}</span>
                    </span>
                  </td>
                  <td className="py-2.5 px-2 text-right text-footnote text-ink-soft tabular">
                    {entry.topic_count}
                  </td>
                  <td className="py-2.5 px-2 text-right text-footnote text-ink-soft tabular hidden sm:table-cell">
                    {entry.selected_count}
                  </td>
                  <td className="py-2.5 px-2 text-right text-footnote text-ink-soft tabular">
                    {entry.spark_count}
                  </td>
                  {hasSparkWindow && (
                    <td className="py-2.5 pl-2 pr-4 text-right">
                      {sparkWindow!.currentUserId === entry.id ? (
                        <span className="text-ink-muted">-</span>
                      ) : (
                        <SparkButton
                          toUserId={entry.id}
                          cycleId={sparkWindow!.cycleId}
                          alreadyGiven={sparkWindow!.sparkedUserId === entry.id}
                          isDisabled={
                            sparkWindow!.sparkedUserId !== null &&
                            sparkWindow!.sparkedUserId !== entry.id
                          }
                        />
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Spark picker - every member, unranked and alphabetical. Recognition
          should not require appearing in a standings table, so this stays
          separate from the table above and keeps its own A-Z order. */}
      {hasSparkWindow && unranked.length > 0 && (
        <section className="rounded-(--radius-card) border border-border bg-paper/40 overflow-hidden">
          <div className="px-4 py-3.5 border-b border-border">
            <h2 className="text-heading text-ink">Give your spark</h2>
            <p className="text-footnote text-ink-muted mt-0.5">
              One per cycle, to anyone who made this month better. Listed A-Z, not ranked.
            </p>
          </div>
          <ul className="divide-y divide-border">
            {unranked.map(member => {
              const alreadyGiven = sparkWindow!.sparkedUserId === member.id
              const isDisabled = sparkWindow!.sparkedUserId !== null && !alreadyGiven
              return (
                <li
                  key={member.id}
                  className={`flex items-center gap-2.5 px-4 py-2.5 min-h-11 transition-colors ${
                    alreadyGiven ? 'bg-saffron/8' : 'hover:bg-kinu/25'
                  }`}
                >
                  <UserAvatar username={member.username ?? 'user'} size={26} />
                  <span className="text-footnote text-ink truncate min-w-0">@{member.username}</span>
                  <span className="ml-auto shrink-0">
                    <SparkButton
                      toUserId={member.id}
                      cycleId={sparkWindow!.cycleId}
                      alreadyGiven={alreadyGiven}
                      isDisabled={isDisabled}
                    />
                  </span>
                </li>
              )
            })}
          </ul>
        </section>
      )}


      {/* Scoring note */}
      <p className="text-[11px] text-cha mt-6 text-center leading-relaxed">
        Ranked by guild score: Sparks ×3, picked topics ×2, ideas ×1.
        <br />
        Counted across every cycle. Ghost pitches are never scored.
      </p>
    </div>
  )
}
