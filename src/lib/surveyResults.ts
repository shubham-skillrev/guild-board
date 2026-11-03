import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { SURVEY_KEY, type SurveyResponse } from '@/lib/survey'

export interface SurveyRow extends SurveyResponse {
  /** Already has a GuildBoard account (by email). */
  member: boolean
}

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
