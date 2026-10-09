import 'server-only'
import type { createAdminClient } from '@/lib/supabase/admin'

type Admin = ReturnType<typeof createAdminClient>

export type EventKind = 'comment' | 'reply' | 'milestone' | 'first_post' | 'drought' | 'ignored' | 'digest'

/** Comments the bot makes on its own initiative, which share one daily cap. */
export const UNPROMPTED: EventKind[] = ['comment', 'milestone', 'first_post']

/**
 * Record that the bot is about to say something. True if this is the first
 * time for (cycle, key); false if it already happened, in which case the
 * caller stays quiet. Claim first, speak second: a retry can never double up.
 */
export async function claim(
  admin: Admin,
  e: { cycleId: string; kind: EventKind; key: string; topicId?: string | null },
): Promise<boolean> {
  const { error } = await admin
    .from('guildbot_events')
    .insert({ cycle_id: e.cycleId, kind: e.kind, event_key: e.key, topic_id: e.topicId ?? null })
  if (!error) return true
  if (error.code !== '23505') console.warn('guildbot claim failed', error.message)
  return false
}

/** How many events of these kinds fired in the last 24 hours. */
export async function countRecent(admin: Admin, kinds: EventKind[], hours = 24): Promise<number> {
  const since = new Date(Date.now() - hours * 3_600_000).toISOString()
  const { count } = await admin
    .from('guildbot_events')
    .select('id', { count: 'exact', head: true })
    .in('kind', kinds)
    .gte('fired_at', since)
  return count ?? 0
}

/** Whether the bot already spoke unprompted on this topic. */
export async function spokeOn(admin: Admin, topicId: string): Promise<boolean> {
  const { count } = await admin
    .from('guildbot_events')
    .select('id', { count: 'exact', head: true })
    .eq('topic_id', topicId)
    .in('kind', UNPROMPTED)
  return (count ?? 0) > 0
}

/** Whether any event of this kind fired in the cycle. */
export async function firedInCycle(admin: Admin, cycleId: string, kind: EventKind): Promise<boolean> {
  const { count } = await admin
    .from('guildbot_events')
    .select('id', { count: 'exact', head: true })
    .eq('cycle_id', cycleId)
    .eq('kind', kind)
  return (count ?? 0) > 0
}
