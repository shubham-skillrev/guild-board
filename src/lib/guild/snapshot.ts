import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { openCycle, slotsFor } from '@/lib/guild/demos'
import { sanitizeTheme } from '@/lib/themes'
import type { Slot } from '@/lib/showtell'

export interface GuildSnapshot {
  members: number
  meeting: { label: string; at: string | null; theme: string | null; themeLine: string | null } | null
  /** Up to three topics on the board, titles only (as any guest sees them). */
  topics: string[]
  spotlight: Slot | null
  demo: Slot | null
}

/** What a newcomer should see first: when we meet, what's being talked about, who's on. */
export async function getGuildSnapshot(): Promise<GuildSnapshot> {
  const admin = createAdminClient()
  const [cycle, { count }] = await Promise.all([
    openCycle(admin),
    admin.from('users').select('id', { count: 'exact', head: true }).eq('is_system', false),
  ])
  if (!cycle) return { members: count ?? 0, meeting: null, topics: [], spotlight: null, demo: null }

  const [{ data: row }, { data: topics }, slots] = await Promise.all([
    admin.from('cycles').select('theme').eq('id', cycle.id).maybeSingle(),
    admin.from('topics').select('title').eq('cycle_id', cycle.id).eq('is_deleted', false).order('score', { ascending: false }).limit(3),
    slotsFor(admin, cycle.id),
  ])
  const theme = sanitizeTheme(row?.theme)
  return {
    members: count ?? 0,
    meeting: { label: cycle.label, at: cycle.meeting_at, theme: theme?.name ?? null, themeLine: theme?.title ?? null },
    topics: (topics ?? []).map(t => t.title),
    spotlight: slots.spotlight,
    demo: slots.demo,
  }
}
