import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Lightbulb, Users, CheckCircle } from '@phosphor-icons/react/dist/ssr'
import { createAdminClient } from '@/lib/supabase/admin'
import { getViewer } from '@/lib/supabase/viewer'
import { getPublicHall, SCORE_WEIGHTS } from '@/lib/guild/publicHall'
import { PublicHall, type SparkWindow } from '@/components/hall/PublicHall'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { SparkButton } from '@/components/voting/SparkButton'
import { StatStrip, StatChip } from '@/components/ui/Section'
import { cn } from '@/lib/utils/cn'

export const metadata: Metadata = { title: 'The guild hall' }

/** Cohort stats: what the guild did together this month, nobody ranked. */
async function cycleStats() {
  const admin = createAdminClient()
  const { data: cycle } = await admin
    .from('cycles')
    .select('id, label')
    .neq('status', 'upcoming')
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!cycle) return null
  const [{ data: topics }, { data: votes }] = await Promise.all([
    admin.from('topics').select('outcome_tag').eq('cycle_id', cycle.id).eq('is_deleted', false),
    admin.from('votes').select('user_id').eq('cycle_id', cycle.id),
  ])
  return {
    label: cycle.label,
    ideas: topics?.length ?? 0,
    voters: new Set((votes ?? []).map(v => v.user_id)).size,
    discussed: (topics ?? []).filter(t => t.outcome_tag && t.outcome_tag !== 'dropped').length,
  }
}

/** The spark window: an open month after its meeting, or a closed one still in its 48 hours. */
async function sparkWindowFor(userId: string, isGuest: boolean): Promise<SparkWindow | null> {
  if (isGuest) return null
  const admin = createAdminClient()
  const now = new Date().toISOString()
  const { data: active } = await admin
    .from('cycles')
    .select('id')
    .or(`and(status.eq.open,meeting_at.lte.${now}),and(status.eq.closed,spark_closes_at.gt.${now})`)
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(1)
    .maybeSingle()
  if (!active) return null
  const { data: given } = await admin
    .from('sparks')
    .select('to_user_id')
    .eq('from_user_id', userId)
    .eq('cycle_id', active.id)
    .maybeSingle()
  return { cycleId: active.id, sparkedUserId: given?.to_user_id ?? null, currentUserId: userId }
}

/**
 * The guild hall: everyone who is making the guild better, as lit windows,
 * then the standings with what each person has done. Lit only by named,
 * visible things; quiet members are never named (see lib/guild/publicHall).
 */
export default async function LeaderboardPage() {
  const { user, isGuest } = await getViewer()
  if (!user) redirect('/login')

  const [{ windows, lit }, stats, spark, { data: members }] = await Promise.all([
    getPublicHall(isGuest ? null : user.id),
    cycleStats(),
    sparkWindowFor(user.id, isGuest),
    createAdminClient().from('users').select('id, username').eq('is_system', false).order('username'),
  ])
  const litIds = new Set(lit.map(w => w.userId))
  const unranked = spark ? (members ?? []).filter(m => m.id !== spark.currentUserId && !litIds.has(m.id)) : []

  return (
    <div className="px-(--pad-page-x) py-8 w-full max-w-(--measure-wide) mx-auto pb-28 md:pb-10">
      <header className="mb-7">
        <h1 className="text-title-1 text-label">The guild hall</h1>
        <p className="mt-1.5 max-w-prose text-callout text-label-2">
          The whole guild in one crowd: the bigger you are and the nearer the middle, the more you’ve done for the guild. Move in: post a topic, comment, put a link on the
          Radar, or show something at a meeting.
        </p>
        {spark && (
          <p className="mt-2 text-footnote font-medium text-ink">
            The spark window is open: give your spark to someone who made this month better. Pick them in the crowd.
          </p>
        )}
      </header>

      {stats && (
        <StatStrip className="mb-8" aria-label={`${stats.label} so far`}>
          <span className="px-2 text-[12px] font-medium text-ink-soft">{stats.label}</span>
          <StatChip icon={Lightbulb} value={stats.ideas} label="ideas pitched" />
          <StatChip icon={Users} value={stats.voters} label="people voted" />
          <StatChip icon={CheckCircle} value={stats.discussed} label="taken forward" />
        </StatStrip>
      )}

      <PublicHall windows={windows} spark={spark} />

      {lit.length > 0 && (
        <section aria-labelledby="hall-standings" className="mt-12">
          <h2 id="hall-standings" className="mb-3 text-title-3 text-label">Who’s lighting it up</h2>
          <div className="elev-1 overflow-x-auto rounded-(--radius-card)">
            <table className="w-full text-footnote">
              <thead>
                <tr className="border-b border-separator text-left text-ink-muted">
                  <th scope="col" className="w-10 px-4 py-2.5 font-medium">#</th>
                  <th scope="col" className="px-4 py-2.5 font-medium">Member</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Score</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Sparks</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Topics</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Picked</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Comments</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Show & Tell</th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">Radar</th>
                  {spark && <th scope="col" className="px-4 py-2.5"><span className="sr-only">Spark</span></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-separator">
                {lit.map((w, i) => (
                  <tr key={w.key} className={cn(w.isYou && 'bg-kinu/40')}>
                    <td className="px-4 py-2.5 font-mono text-[12px] text-ink-muted tabular">{i + 1}</td>
                    <td className="px-4 py-2.5">
                      <span className="flex items-center gap-2.5">
                        <UserAvatar username={w.username ?? ''} size={26} />
                        <span className="text-ink">@{w.username}</span>
                        {w.isYou && <span className="text-meta text-ink-muted">you</span>}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right font-medium text-ink tabular">{w.stats?.score}</td>
                    <td className="px-3 py-2.5 text-right text-ink-soft tabular">{w.stats?.sparks}</td>
                    <td className="px-3 py-2.5 text-right text-ink-soft tabular">{w.stats?.topics}</td>
                    <td className="px-3 py-2.5 text-right text-ink-soft tabular">{w.stats?.picked}</td>
                    <td className="px-3 py-2.5 text-right text-ink-soft tabular">{w.stats?.comments}</td>
                    <td className="px-3 py-2.5 text-right text-ink-soft tabular">{w.stats?.demos}</td>
                    <td className="px-3 py-2.5 text-right text-ink-soft tabular">{w.stats?.radar}</td>
                    {spark && (
                      <td className="px-4 py-2">
                        {w.userId && w.userId !== spark.currentUserId && (
                          <SparkButton
                            toUserId={w.userId}
                            cycleId={spark.cycleId}
                            alreadyGiven={spark.sparkedUserId === w.userId}
                            isDisabled={spark.sparkedUserId !== null && spark.sparkedUserId !== w.userId}
                          />
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Sparks aren't only for people already lit: everyone else, A-Z. */}
      {spark && unranked.length > 0 && (
        <section aria-labelledby="hall-spark" className="mt-10">
          <h2 id="hall-spark" className="text-title-3 text-label">Spark someone who isn’t lit yet</h2>
          <p className="mb-3 mt-0.5 text-footnote text-ink-muted">One spark per month. Listed A to Z, not ranked.</p>
          <ul className="elev-1 rounded-(--radius-card) divide-y divide-separator overflow-hidden">
            {unranked.map(m => (
              <li key={m.id} className="flex items-center gap-2.5 px-4 py-2.5 min-h-11">
                <UserAvatar username={m.username ?? 'user'} size={26} />
                <span className="min-w-0 truncate text-footnote text-ink">@{m.username}</span>
                <span className="ml-auto shrink-0">
                  <SparkButton
                    toUserId={m.id}
                    cycleId={spark.cycleId}
                    alreadyGiven={spark.sparkedUserId === m.id}
                    isDisabled={spark.sparkedUserId !== null && spark.sparkedUserId !== m.id}
                  />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-8 text-center text-[11px] leading-relaxed text-cha">
        Guild score: sparks ×{SCORE_WEIGHTS.sparks}, picked topics ×{SCORE_WEIGHTS.picked}, topics ×{SCORE_WEIGHTS.topics},
        comments ×{SCORE_WEIGHTS.comments}, Show & Tell ×{SCORE_WEIGHTS.demos}, Radar links ×{SCORE_WEIGHTS.radar}, across every month.
        <br />
        Only what you did under your name counts. Anonymous posts and comments never do, and visits are never shown.
      </p>
    </div>
  )
}
