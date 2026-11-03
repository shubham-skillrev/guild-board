import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { PASSES_PER_YEAR, type Slot } from '@/lib/showtell'

export interface OpenCycle {
  id: string
  label: string
  meeting_at: string | null
}

/** The month the guild is working towards: the newest open cycle. */
export async function openCycle(admin: SupabaseClient): Promise<OpenCycle | null> {
  const { data } = await admin
    .from('cycles')
    .select('id, label, meeting_at')
    .in('status', ['open', 'frozen'])
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(1)
    .maybeSingle()
  return data ?? null
}

/** Spotlight passes used this calendar year (India time). */
export async function passesUsed(admin: SupabaseClient, userId: string): Promise<number> {
  const year = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).slice(0, 4)
  const { count } = await admin
    .from('demos')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('kind', 'spotlight')
    .eq('status', 'passed')
    .gte('responded_at', `${year}-01-01T00:00:00+05:30`)
  return count ?? 0
}

export function passesLeft(used: number): number {
  return Math.max(0, PASSES_PER_YEAR - used)
}

/** The confirmed Spotlight and demo for a meeting, with presenters' handles. */
export async function slotsFor(admin: SupabaseClient, cycleId: string): Promise<{ spotlight: Slot | null; demo: Slot | null }> {
  const { data } = await admin
    .from('demos')
    .select('id, kind, format, title, blurb, users!demos_user_id_fkey(username)')
    .eq('cycle_id', cycleId)
    .in('status', ['confirmed', 'done'])
    .order('updated_at', { ascending: true })

  const slots = (data ?? []).map(d => ({
    id: d.id,
    kind: d.kind,
    format: d.format,
    title: d.title,
    blurb: d.blurb,
    username: (d.users as unknown as { username: string } | null)?.username ?? 'someone',
  })) as Slot[]

  return {
    spotlight: slots.find(s => s.kind === 'spotlight') ?? null,
    demo: slots.find(s => s.kind === 'demo') ?? null,
  }
}
