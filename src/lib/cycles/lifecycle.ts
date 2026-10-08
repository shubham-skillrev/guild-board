import 'server-only'
import type { createAdminClient } from '@/lib/supabase/admin'
import type { CycleTheme } from '@/lib/themes'
import type { Cycle } from '@/types'
import { cycleLabel } from '@/lib/cycles/dates'

/**
 * Opening and closing a month. Shared by the admin routes and the autopilot
 * cron so both do exactly the same thing; notifications stay with the caller,
 * which knows whether it can defer them past the response.
 */

type Admin = ReturnType<typeof createAdminClient>

/** How long sparks stay open after a cycle closes. */
export const SPARK_WINDOW_HOURS = 48

/** Close a cycle: board locked for good, sparks open for 48 more hours. */
export async function closeCycle(admin: Admin, cycleId: string): Promise<Cycle> {
  const sparkClosesAt = new Date(Date.now() + SPARK_WINDOW_HOURS * 3_600_000)
  const { data, error } = await admin
    .from('cycles')
    .update({ status: 'closed', spark_closes_at: sparkClosesAt.toISOString() })
    .eq('id', cycleId)
    .select()
    .single()
  if (error || !data) throw new Error(`closeCycle: ${error?.message ?? 'no row'}`)
  return data as Cycle
}

export type CreateCycleResult =
  | { ok: true; cycle: Cycle }
  | { ok: false; reason: 'duplicate'; message: string }

/** Create a month's cycle, open from now. One per month. */
export async function createCycle(
  admin: Admin,
  args: { year: number; month: number; label?: string; meetingAt?: string | null; theme?: CycleTheme | null },
): Promise<CreateCycleResult> {
  const label = args.label ?? cycleLabel(args.year, args.month)

  const { data: existing } = await admin
    .from('cycles')
    .select('id')
    .eq('month', args.month)
    .eq('year', args.year)
    .maybeSingle()
  if (existing) return { ok: false, reason: 'duplicate', message: `A cycle for ${label} already exists` }

  const insert: Record<string, unknown> = {
    label,
    month: args.month,
    year: args.year,
    status: 'open',
    opens_at: new Date().toISOString(),
  }
  if (args.meetingAt) insert.meeting_at = args.meetingAt
  if (args.theme) insert.theme = args.theme

  const { data, error } = await admin.from('cycles').insert(insert).select().single()
  if (error || !data) throw new Error(`createCycle: ${error?.message ?? 'no row'}`)
  return { ok: true, cycle: data as Cycle }
}
