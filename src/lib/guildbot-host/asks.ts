import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'

/** Asks per member per rolling week. Keeps the chat a tool, not a hangout. */
export const WEEKLY_LIMIT = 15
const WEEK_MS = 7 * 86_400_000

/**
 * Where a member stands with GuildBot this week: what the door plate on its
 * home shows. `nextAt` is when the oldest ask in the window ages out, so a
 * member with none left can be told when the door opens again.
 */
export interface Asks {
  left: number
  limit: number
  nextAt: string | null
}

/** Counts the member's own messages only; the service role must pin `userId`. */
export async function asksFor(admin: SupabaseClient, userId: string): Promise<Asks> {
  const { data } = await admin
    .from('guildbot_messages')
    .select('created_at')
    .eq('user_id', userId)
    .eq('role', 'user')
    .gte('created_at', new Date(Date.now() - WEEK_MS).toISOString())
    .order('created_at', { ascending: true })
    .limit(WEEKLY_LIMIT)
  const used = data?.length ?? 0
  const left = Math.max(0, WEEKLY_LIMIT - used)
  const oldest = data?.[0]?.created_at
  return {
    left,
    limit: WEEKLY_LIMIT,
    nextAt: left === 0 && oldest ? new Date(new Date(oldest).getTime() + WEEK_MS).toISOString() : null,
  }
}
