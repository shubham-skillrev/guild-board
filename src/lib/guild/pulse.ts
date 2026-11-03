import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { SURVEY_KEY } from '@/lib/survey'
import { getSurveyState } from '@/lib/surveyResults'
import { openCycle } from '@/lib/guild/demos'

/**
 * The numbers behind Pulse, and the to-do list they imply.
 *
 * Code decides every number and every action here. Kers only narrates them
 * (lib/guild/kers.ts), so a briefing can be witty but never wrong. Every query
 * tolerates a missing table (before migrations 038/040) by counting zero.
 */

const DAY = 86_400_000
const PAGE = 1000

/** Every visit row since a day, in pages (PostgREST caps a response at 1000). */
export async function visitsSince(day: string): Promise<{ user_id: string; day: string; app: boolean; visits: number; areas: string[] }[]> {
  const admin = createAdminClient()
  const out: { user_id: string; day: string; app: boolean; visits: number; areas: string[] }[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await admin
      .from('user_visits')
      .select('user_id, day, app, visits, areas')
      .gte('day', day)
      .order('day', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error || !data?.length) break
    out.push(...data)
    if (data.length < PAGE) break
  }
  return out
}

export interface Week {
  /** Monday of the week, yyyy-mm-dd (India). */
  week: string
  active: number
  joined: number
}

export interface PulseFacts {
  members: number
  joined30: number
  active7: number
  active30: number
  /** Members seen in the 30-90 days before, not in the last 30. */
  wentQuiet: number
  appUsers: number
  pushOn: number
  weeks: Week[]
  cycle: { label: string; daysToMeeting: number | null; topics: number; votes: number; comments: number } | null
  survey: { open: boolean; answers: number; noAccount: number; couldDemo: number; nominations: number }
  showTell: { spotlight: boolean; demo: boolean; invited: number; queued: number }
  radar: number
}

export interface PulseAction {
  id: string
  text: string
  href: string
  /** The one that matters most this week leads the list. */
  weight: number
}

function istDay(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

function mondayOf(day: string): string {
  const d = new Date(`${day}T00:00:00Z`)
  const back = (d.getUTCDay() + 6) % 7
  return istDay(new Date(d.getTime() - back * DAY + 12 * 3_600_000))
}

/** Optional: members of one team only (the lead view). */
export async function getPulseFacts(teamId?: string): Promise<PulseFacts> {
  const admin = createAdminClient()
  const now = Date.now()
  const since90 = istDay(new Date(now - 90 * DAY))
  const since30Day = istDay(new Date(now - 30 * DAY))
  const since7Day = istDay(new Date(now - 7 * DAY))

  let usersQ = admin.from('users').select('id, email, created_at').eq('is_system', false)
  if (teamId) usersQ = usersQ.eq('team_id', teamId)
  const { data: users } = await usersQ
  const people = users ?? []
  const ids = new Set(people.map(u => u.id))
  const emails = new Set(people.map(u => (u.email ?? '').toLowerCase()))

  const [visits, { data: subs }, cycle, surveyState, { data: answers }] = await Promise.all([
    visitsSince(since90),
    admin.from('push_subscriptions').select('user_id'),
    openCycle(admin),
    getSurveyState(),
    admin.from('survey_responses').select('email, demo, nominee_name').eq('survey', SURVEY_KEY),
  ])

  const mine = visits.filter(v => ids.has(v.user_id))
  const seen = (since: string) => new Set(mine.filter(v => v.day >= since).map(v => v.user_id))
  const recent = seen(since30Day)
  const before = new Set(mine.filter(v => v.day < since30Day).map(v => v.user_id))

  // Eight weeks of active members and sign-ups, oldest first.
  const weeks: Week[] = []
  const thisMonday = mondayOf(istDay(new Date(now)))
  for (let i = 7; i >= 0; i--) {
    const start = istDay(new Date(new Date(`${thisMonday}T12:00:00Z`).getTime() - i * 7 * DAY))
    const end = istDay(new Date(new Date(`${start}T12:00:00Z`).getTime() + 7 * DAY))
    weeks.push({
      week: start,
      active: new Set(mine.filter(v => v.day >= start && v.day < end).map(v => v.user_id)).size,
      joined: people.filter(u => { const d = istDay(new Date(u.created_at)); return d >= start && d < end }).length,
    })
  }

  let cycleFacts: PulseFacts['cycle'] = null
  let showTell: PulseFacts['showTell'] = { spotlight: false, demo: false, invited: 0, queued: 0 }
  let radar = 0
  if (cycle) {
    const [{ data: topics }, { count: votes }, { data: demos }, { count: links }] = await Promise.all([
      admin.from('topics').select('id, user_id, comment_count').eq('cycle_id', cycle.id).eq('is_deleted', false).eq('is_system', false),
      admin.from('votes').select('id', { count: 'exact', head: true }).eq('cycle_id', cycle.id),
      admin.from('demos').select('kind, status, cycle_id, user_id').in('status', ['invited', 'proposed', 'confirmed']),
      admin.from('radar_links').select('id', { count: 'exact', head: true }).eq('cycle_id', cycle.id).eq('is_deleted', false),
    ])
    const inTeam = <T extends { user_id: string }>(rows: T[]) => (teamId ? rows.filter(r => ids.has(r.user_id)) : rows)
    const ts = inTeam(topics ?? [])
    cycleFacts = {
      label: cycle.label,
      daysToMeeting: cycle.meeting_at ? Math.ceil((new Date(cycle.meeting_at).getTime() - now) / DAY) : null,
      topics: ts.length,
      votes: teamId ? 0 : votes ?? 0,
      comments: ts.reduce((n, t) => n + (t.comment_count ?? 0), 0),
    }
    const ds = inTeam(demos ?? [])
    showTell = {
      spotlight: ds.some(d => d.kind === 'spotlight' && d.status === 'confirmed' && d.cycle_id === cycle.id),
      demo: ds.some(d => d.kind === 'demo' && d.status === 'confirmed' && d.cycle_id === cycle.id),
      invited: ds.filter(d => d.status === 'invited').length,
      queued: ds.filter(d => d.kind === 'demo' && d.status === 'proposed').length,
    }
    radar = links ?? 0
  }

  const surveyRows = (answers ?? []).filter(a => !teamId || emails.has(a.email))
  return {
    members: people.length,
    joined30: people.filter(u => new Date(u.created_at).getTime() >= now - 30 * DAY).length,
    active7: seen(since7Day).size,
    active30: recent.size,
    wentQuiet: [...before].filter(id => !recent.has(id)).length,
    appUsers: new Set(mine.filter(v => v.app && v.day >= since30Day).map(v => v.user_id)).size,
    pushOn: new Set((subs ?? []).map(s => s.user_id).filter(id => ids.has(id))).size,
    weeks,
    cycle: cycleFacts,
    survey: {
      open: surveyState.open,
      answers: surveyRows.length,
      noAccount: surveyRows.filter(a => !emails.has(a.email)).length,
      couldDemo: surveyRows.filter(a => a.demo === 'yes' || a.demo === 'maybe').length,
      nominations: surveyRows.filter(a => a.nominee_name).length,
    },
    showTell,
    radar,
  }
}

/** What to do this week, most useful first. Each one links to where it's done. */
export function pulseActions(f: PulseFacts): PulseAction[] {
  const out: PulseAction[] = []
  const meetingSoon = f.cycle?.daysToMeeting != null && f.cycle.daysToMeeting >= 0 && f.cycle.daysToMeeting <= 10

  if (f.cycle && !f.showTell.spotlight) {
    out.push({
      id: 'spotlight',
      text: f.showTell.invited
        ? `${f.showTell.invited} Spotlight invite${f.showTell.invited === 1 ? ' is' : 's are'} waiting for an answer`
        : `No Spotlight for ${f.cycle.label} yet${f.survey.nominations ? `: ${f.survey.nominations} nominations to pick from` : ''}`,
      href: '/admin/topics#showtell',
      weight: meetingSoon ? 100 : 80,
    })
  }
  if (f.cycle && !f.showTell.demo) {
    out.push({
      id: 'demo',
      text: f.showTell.queued
        ? `Demo slot is open and ${f.showTell.queued} offer${f.showTell.queued === 1 ? ' is' : 's are'} in the queue: book one`
        : f.survey.couldDemo
          ? `Demo slot is open: ${f.survey.couldDemo} people said in the survey they could show something`
          : 'Demo slot is open and nobody has offered yet',
      href: f.showTell.queued ? '/admin/topics#showtell' : '/admin/people?segment=could-demo',
      weight: meetingSoon ? 95 : 70,
    })
  }
  if (f.survey.noAccount > 0) {
    out.push({
      id: 'no-account',
      text: `${f.survey.noAccount} people answered the survey but have no account: invite them`,
      href: '/admin/people?segment=no-account',
      weight: 75,
    })
  }
  if (f.wentQuiet > 0) {
    out.push({
      id: 'quiet',
      text: `${f.wentQuiet} member${f.wentQuiet === 1 ? '' : 's'} went quiet this month: a nudge might help`,
      href: '/admin/people?segment=quiet',
      weight: 60,
    })
  }
  if (f.survey.open && f.members > 0 && f.survey.answers < f.members / 2) {
    out.push({
      id: 'survey',
      text: `Only ${f.survey.answers} survey answers so far: share the link in Slack again`,
      href: '/admin/survey',
      weight: 50,
    })
  }
  if (f.cycle && meetingSoon && f.cycle.topics < 3) {
    out.push({
      id: 'topics',
      text: `${f.cycle.label} meets in ${f.cycle.daysToMeeting} day${f.cycle.daysToMeeting === 1 ? '' : 's'} with ${f.cycle.topics} topic${f.cycle.topics === 1 ? '' : 's'} on the board`,
      href: '/admin/run',
      weight: 90,
    })
  }
  if (f.cycle && f.radar === 0) {
    out.push({ id: 'radar', text: 'The Radar is empty: drop one link to get it going', href: '/bytes#radar', weight: 30 })
  }
  return out.sort((a, b) => b.weight - a.weight)
}

/** The facts Kers may quote, flat. Nothing here names a person. */
export function kersFacts(f: PulseFacts) {
  return {
    members: f.members,
    joined_last_30_days: f.joined30,
    active_last_7_days: f.active7,
    active_last_30_days: f.active30,
    went_quiet: f.wentQuiet,
    use_the_app: f.appUsers,
    notifications_on: f.pushOn,
    month: f.cycle?.label ?? null,
    days_to_meeting: f.cycle?.daysToMeeting ?? null,
    topics_this_month: f.cycle?.topics ?? 0,
    survey_answers: f.survey.answers,
    survey_answers_without_account: f.survey.noAccount,
    spotlight_booked: f.showTell.spotlight,
    demo_booked: f.showTell.demo,
    radar_links: f.radar,
  }
}

/**
 * Kers' written line, for when the model is out or strays. Same voice, fewer
 * jokes: one observation and the top action.
 */
export function pulseFallback(f: PulseFacts, actions: PulseAction[]): string {
  const opener =
    f.active30 === 0
      ? 'Nobody has been in this month. I checked twice.'
      : f.joined30 > 0
        ? `${f.active30} people dropped by this month, ${f.joined30} of them brand new. I’m choosing to call that momentum.`
        : `${f.active30} people dropped by this month. Same faces, very loyal, slightly suspicious.`
  const next = actions[0] ? ` Start here: ${actions[0].text.charAt(0).toLowerCase()}${actions[0].text.slice(1)}.` : ' Nothing urgent. Enjoy it while it lasts.'
  return `${opener}${next}`
}
