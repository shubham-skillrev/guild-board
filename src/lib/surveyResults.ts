import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { SURVEY_KEY, type SurveyResponse } from '@/lib/survey'

export interface SurveyRow extends SurveyResponse {
  /** Already has a GuildBoard account (by email). */
  member: boolean
}

// Answers, the open/closed switch and the board card's status all read with
// the service role: the tables have no member grants (migrations 037, 038).

/**
 * Every answer to the current survey, newest first, with whether the person
 * already has an account. Service role: callers must have checked for an
 * admin first. Names and emails never leave the admin panel and its CSV.
 */
export async function getSurveyRows(): Promise<SurveyRow[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('survey_responses')
    .select('id, name, email, verified, role, attended, join_reasons, join_other, learn_next, demo, demo_idea, nominee_name, nominee_why, meeting_slot, updated_at')
    .eq('survey', SURVEY_KEY)
    .order('updated_at', { ascending: false })

  const rows = (data ?? []) as SurveyResponse[]
  if (!rows.length) return []

  const { data: users } = await admin
    .from('users')
    .select('email')
    .in('email', rows.map(r => r.email))
  const members = new Set((users ?? []).map(u => (u.email as string).toLowerCase()))

  return rows.map(r => ({
    ...r,
    join_reasons: r.join_reasons ?? [],
    join_other: r.join_other ?? '',
    learn_next: r.learn_next ?? '',
    demo_idea: r.demo_idea ?? '',
    nominee_name: r.nominee_name ?? '',
    nominee_why: r.nominee_why ?? '',
    member: members.has(r.email),
  }))
}

export interface SurveyState {
  /** Taking answers right now: switched on and not past its close date. */
  open: boolean
  /** The admin switch alone, before the close date is applied. */
  switchedOn: boolean
  closesAt: string | null
}

/**
 * Whether the current survey is taking answers. Before migration 038 there
 * is no switch, so the survey counts as open.
 */
export async function getSurveyState(): Promise<SurveyState> {
  const { data, error } = await createAdminClient()
    .from('surveys')
    .select('open, closes_at')
    .eq('key', SURVEY_KEY)
    .maybeSingle()
  if (error || !data) return { open: true, switchedOn: true, closesAt: null }
  const closesAt = (data.closes_at as string | null) ?? null
  const pastClose = !!closesAt && new Date(closesAt).getTime() <= Date.now()
  return { open: data.open && !pastClose, switchedOn: data.open, closesAt }
}
