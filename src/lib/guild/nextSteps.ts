import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { SURVEY_KEY } from '@/lib/survey'
import { getSurveyState } from '@/lib/surveyResults'
import { openCycle } from '@/lib/guild/demos'
import { isNewMember } from '@/lib/onboarding'

/**
 * What one person could do next, most important first. The board shows only
 * the top one (one Kers card, not a stack of banners); the profile lists the
 * standing ones as "Ways to take part".
 *
 *   invite           they have a Spotlight or demo invitation to answer
 *   note             an organiser sent them a note
 *   getting_started  their first two weeks, checklist not finished
 *   survey           the survey is open and they haven't answered
 *   volunteer        the demo slot is open and they're likely to say yes
 *                    (said "could show" in the survey, or post under their name)
 *   radar            they haven't put a link on this month's Radar
 */

export type StepKind = 'invite' | 'note' | 'getting_started' | 'survey' | 'volunteer' | 'radar'

export interface Step {
  kind: StepKind
  /** For volunteer: what they said they could show. */
  idea?: string | null
}

/** Their standing on the profile's "Ways to take part". */
export interface Involvement {
  answeredSurvey: boolean
  nominated: boolean
  offered: boolean
  radarThisMonth: boolean
  pushOn: boolean
  demos: { id: string; kind: string; status: string; title: string | null; cycle: string | null }[]
  meetingOpen: boolean
}

export async function getInvolvement(userId: string): Promise<Involvement & { email: string; createdAt: string | null; idea: string | null; namedPosts: number; demoSlotOpen: boolean; surveyOpen: boolean; onboardingOpen: boolean; notes: number }> {
  const admin = createAdminClient()
  const head = { count: 'exact' as const, head: true }
  const { data: me } = await admin.from('users').select('email, created_at').eq('id', userId).maybeSingle()
  const email = (me?.email ?? '').toLowerCase()
  const cycle = await openCycle(admin)

  const [{ data: answer }, { data: demos }, radar, push, posts, notes, slot, state, votes, comments, app] = await Promise.all([
    admin.from('survey_responses').select('demo, demo_idea, nominee_name').eq('survey', SURVEY_KEY).eq('email', email).maybeSingle(),
    admin.from('demos').select('id, kind, status, title, cycles(label)').eq('user_id', userId).in('status', ['proposed', 'invited', 'confirmed', 'done']).order('created_at', { ascending: false }).limit(8),
    cycle ? admin.from('radar_links').select('id', head).eq('cycle_id', cycle.id).eq('user_id', userId).eq('is_deleted', false) : Promise.resolve({ count: 0 }),
    admin.from('push_subscriptions').select('id', head).eq('user_id', userId),
    admin.from('topics').select('id', head).eq('user_id', userId).eq('is_anonymous', false).eq('is_deleted', false),
    admin.from('nudges').select('id', head).eq('user_id', userId).in('channel', ['inbox', 'push']).is('seen_at', null),
    cycle ? admin.from('demos').select('id', head).eq('cycle_id', cycle.id).eq('kind', 'demo').in('status', ['proposed', 'invited', 'confirmed']) : Promise.resolve({ count: 1 }),
    getSurveyState(),
    admin.from('votes').select('id', head).eq('user_id', userId),
    admin.from('comments').select('id', head).eq('user_id', userId).eq('is_deleted', false),
    admin.from('user_visits').select('day', head).eq('user_id', userId).eq('app', true),
  ])

  const meetingSoon = !!cycle?.meeting_at && new Date(cycle.meeting_at).getTime() - Date.now() > 3 * 86_400_000
  const rows = (demos ?? []).map(d => ({
    id: d.id, kind: d.kind, status: d.status, title: d.title,
    cycle: (d.cycles as unknown as { label: string } | null)?.label ?? null,
  }))
  // The getting-started checklist is "open" until every step is done.
  const checklistDone = !!answer && (votes.count ?? 0) > 0 && (posts.count ?? 0) + (comments.count ?? 0) > 0 && (push.count ?? 0) > 0 && (app.count ?? 0) > 0

  return {
    email,
    createdAt: me?.created_at ?? null,
    answeredSurvey: !!answer,
    nominated: !!answer?.nominee_name,
    offered: rows.some(d => d.kind === 'demo' || d.status === 'confirmed' || d.status === 'done'),
    radarThisMonth: (radar.count ?? 0) > 0,
    pushOn: (push.count ?? 0) > 0,
    demos: rows,
    meetingOpen: !!cycle,
    idea: answer?.demo === 'yes' || answer?.demo === 'maybe' ? answer?.demo_idea ?? '' : null,
    namedPosts: posts.count ?? 0,
    demoSlotOpen: !!cycle && meetingSoon && (slot.count ?? 0) === 0,
    surveyOpen: state.open,
    onboardingOpen: isNewMember(me?.created_at) && !checklistDone,
    notes: notes.count ?? 0,
  }
}

/** The board's queue for a member, most important first. */
export async function nextSteps(userId: string): Promise<Step[]> {
  const i = await getInvolvement(userId)
  const steps: Step[] = []
  if (i.demos.some(d => d.status === 'invited')) steps.push({ kind: 'invite' })
  if (i.notes > 0) steps.push({ kind: 'note' })
  if (i.onboardingOpen) steps.push({ kind: 'getting_started' })
  // New members see the survey inside the checklist, so it isn't asked twice.
  if (i.surveyOpen && !i.answeredSurvey && !i.onboardingOpen) steps.push({ kind: 'survey' })
  const likely = i.idea !== null || i.namedPosts >= 2
  if (i.demoSlotOpen && likely && !i.demos.some(d => ['proposed', 'invited', 'confirmed'].includes(d.status))) {
    steps.push({ kind: 'volunteer', idea: i.idea })
  }
  if (i.meetingOpen && !i.radarThisMonth) steps.push({ kind: 'radar' })
  return steps
}
