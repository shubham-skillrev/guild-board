import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { SURVEY_KEY, ROLES, labelOf } from '@/lib/survey'
import { visitsSince } from '@/lib/guild/pulse'

/**
 * How the guild is growing: sign-ups over time (and where they came from),
 * how far new members get, who joined recently, and which roles are in.
 *
 * Per-person facts here are named activity only, same as the People tab:
 * a recent joiner "said something" only if they did it under their name.
 */

/** People at SkillRev, for "how much of the company is in". Change when it changes. */
export const COMPANY_SIZE = 90

const DAY = 86_400_000

export type Source = 'survey' | 'join' | 'direct' | 'unknown'
export type Grain = 'day' | 'week' | 'month'

export interface Bucket {
  label: string
  start: string
  bySource: Record<Source, number>
  total: number
  /** Members at the end of this period. */
  running: number
}

export interface Joiner {
  userId: string
  name: string
  username: string
  joined: string
  role: string | null
  source: Source
  pickedName: boolean
  voted: boolean
  spoke: boolean
  push: boolean
}

export interface Growth {
  members: number
  joined30: number
  series: Record<Grain, Bucket[]>
  funnel: { step: string; n: number; of: number }[]
  recent: Joiner[]
  roles: { role: string; members: number; waiting: number }[]
  noRole: number
}

/** Every row of a query, in pages (PostgREST caps a response at 1000). */
async function all<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999)
    if (error || !data?.length) break
    out.push(...data)
    if (data.length < 1000) break
  }
  return out
}

function istDay(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

function startOf(day: string, grain: Grain): string {
  if (grain === 'day') return day
  if (grain === 'month') return `${day.slice(0, 7)}-01`
  const d = new Date(`${day}T12:00:00Z`)
  return istDay(new Date(d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY))
}

function stepBack(start: string, grain: Grain, n: number): string {
  const d = new Date(`${start}T12:00:00Z`)
  if (grain === 'month') { d.setUTCMonth(d.getUTCMonth() - n); return istDay(d).slice(0, 7) + '-01' }
  return istDay(new Date(d.getTime() - n * (grain === 'week' ? 7 : 1) * DAY))
}

function label(start: string, grain: Grain): string {
  const d = new Date(`${start}T12:00:00Z`)
  return grain === 'month'
    ? d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
    : d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

export async function getGrowth(): Promise<Growth> {
  const admin = createAdminClient()
  const now = Date.now()
  const [{ data: users }, votes, topics, comments, { data: subs }, { data: survey }, visits] = await Promise.all([
    admin.from('users').select('*').eq('is_system', false),
    all<{ user_id: string }>((f, t) => admin.from('votes').select('user_id').range(f, t)),
    all<{ user_id: string }>((f, t) => admin.from('topics').select('user_id').eq('is_anonymous', false).eq('is_deleted', false).range(f, t)),
    all<{ user_id: string }>((f, t) => admin.from('comments').select('user_id').eq('is_anonymous', false).eq('is_deleted', false).range(f, t)),
    admin.from('push_subscriptions').select('user_id'),
    admin.from('survey_responses').select('email, role').eq('survey', SURVEY_KEY),
    visitsSince(istDay(new Date(now - 120 * DAY))),
  ])
  const people = (users ?? []) as { id: string; username: string; real_name: string | null; email: string | null; created_at: string; signup_source?: string | null }[]
  const voted = new Set(votes.map(v => v.user_id))
  const spoke = new Set([...topics, ...comments].map(r => r.user_id))
  const pushOn = new Set((subs ?? []).map(s => s.user_id))
  const roleBy = new Map((survey ?? []).map(s => [s.email, s.role as string]))
  const sourceOf = (u: (typeof people)[number]): Source =>
    u.signup_source === 'survey' || u.signup_source === 'join' || u.signup_source === 'direct' ? u.signup_source : 'unknown'

  // ── Sign-ups per period, by source, with the running total ──
  const today = istDay(new Date(now))
  const spans: Record<Grain, number> = { day: 30, week: 12, month: 12 }
  const series = {} as Record<Grain, Bucket[]>
  for (const grain of ['day', 'week', 'month'] as Grain[]) {
    const last = startOf(today, grain)
    const starts = Array.from({ length: spans[grain] }, (_, i) => stepBack(last, grain, spans[grain] - 1 - i))
    const buckets: Bucket[] = starts.map(start => ({
      label: label(start, grain), start, bySource: { survey: 0, join: 0, direct: 0, unknown: 0 }, total: 0, running: 0,
    }))
    let before = 0
    for (const u of people) {
      const s = startOf(istDay(new Date(u.created_at)), grain)
      const b = buckets.find(x => x.start === s)
      if (b) { b.bySource[sourceOf(u)] += 1; b.total += 1 } else if (s < starts[0]) before += 1
    }
    let running = before
    for (const b of buckets) { running += b.total; b.running = running }
    series[grain] = buckets
  }

  // ── Funnel: members who joined in the last 90 days ──
  const cohort = people.filter(u => now - new Date(u.created_at).getTime() <= 90 * DAY)
  const seenDays = new Map<string, Set<string>>()
  for (const v of visits) { const s = seenDays.get(v.user_id) ?? new Set(); s.add(v.day); seenDays.set(v.user_id, s) }
  const oldEnough = cohort.filter(u => now - new Date(u.created_at).getTime() >= 14 * DAY)
  const cameBack = oldEnough.filter(u => {
    const from = istDay(new Date(new Date(u.created_at).getTime() + 7 * DAY))
    const to = istDay(new Date(new Date(u.created_at).getTime() + 14 * DAY))
    return [...(seenDays.get(u.id) ?? [])].some(d => d >= from && d < to)
  })
  const n = cohort.length
  const funnel = [
    { step: 'Joined', n, of: n },
    { step: 'Picked a username', n: cohort.filter(u => u.username && !u.username.startsWith('user_')).length, of: n },
    { step: 'Voted on a topic', n: cohort.filter(u => voted.has(u.id)).length, of: n },
    { step: 'Commented or posted', n: cohort.filter(u => spoke.has(u.id)).length, of: n },
    { step: 'Came back in week two', n: cameBack.length, of: oldEnough.length },
  ]

  // ── Who joined in the last 30 days ──
  const recent: Joiner[] = people
    .filter(u => now - new Date(u.created_at).getTime() <= 30 * DAY)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map(u => ({
      userId: u.id,
      name: u.real_name || `@${u.username}`,
      username: u.username,
      joined: u.created_at,
      role: roleBy.get((u.email ?? '').toLowerCase()) ? labelOf(ROLES, roleBy.get((u.email ?? '').toLowerCase())) : null,
      source: sourceOf(u),
      pickedName: !!u.username && !u.username.startsWith('user_'),
      voted: voted.has(u.id),
      spoke: spoke.has(u.id),
      push: pushOn.has(u.id),
    }))

  // ── Roles: members (by their survey answer) and survey people not in yet ──
  const memberEmails = new Set(people.map(u => (u.email ?? '').toLowerCase()))
  const roles = ROLES.map(r => ({
    role: r.label,
    members: (survey ?? []).filter(s => s.role === r.value && memberEmails.has(s.email)).length,
    waiting: (survey ?? []).filter(s => s.role === r.value && !memberEmails.has(s.email)).length,
  })).filter(r => r.members + r.waiting > 0).sort((a, b) => b.members + b.waiting - (a.members + a.waiting))
  const noRole = people.filter(u => !roleBy.has((u.email ?? '').toLowerCase())).length

  return {
    members: people.length,
    joined30: recent.length,
    series,
    funnel,
    recent,
    roles,
    noRole,
  }
}
