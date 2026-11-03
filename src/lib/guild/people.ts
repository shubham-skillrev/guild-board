import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { SURVEY_KEY } from '@/lib/survey'
import { visitsSince } from '@/lib/guild/pulse'
import { NUDGE_GAP_DAYS, type ActivityLevel, type Person } from '@/lib/people'

/**
 * Everyone the guild could reach, for the People tab: members with their
 * activity, and survey answerers who have no account yet.
 *
 * ── Anonymity ────────────────────────────────────────────────────────────
 * Posts and comments made as a ghost count towards a person's activity LEVEL
 * (a blend of everything, four steps, no number shown), and nowhere else.
 * Every exact count here is named activity only, so no one can subtract a
 * visible count from a total and learn which ghost posts are whose.
 */

const DAY = 86_400_000
const WINDOW_DAYS = 60

function istDay(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

function levelOf(score: number): ActivityLevel {
  if (score >= 25) return 'driving'
  if (score >= 10) return 'regular'
  if (score >= 3) return 'showing_up'
  return 'quiet'
}

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

export async function getPeople(): Promise<{ people: Person[] }> {
  const admin = createAdminClient()
  const now = Date.now()
  const since = new Date(now - WINDOW_DAYS * DAY).toISOString()
  const since30 = istDay(new Date(now - 30 * DAY))

  const [
    { data: users },
    visits,
    topics,
    comments,
    votes,
    { data: sparks },
    { data: radar },
    { data: demos },
    { data: subs },
    { data: survey },
    { data: nudges },
  ] = await Promise.all([
    admin.from('users').select('id, username, real_name, email, created_at, nudges_off, role').eq('is_system', false),
    visitsSince(istDay(new Date(now - 90 * DAY))),
    all<{ user_id: string; is_anonymous: boolean }>((f, t) => admin.from('topics').select('user_id, is_anonymous').eq('is_deleted', false).gte('created_at', since).range(f, t)),
    all<{ user_id: string; is_anonymous: boolean }>((f, t) => admin.from('comments').select('user_id, is_anonymous').eq('is_deleted', false).gte('created_at', since).range(f, t)),
    all<{ user_id: string }>((f, t) => admin.from('votes').select('user_id').gte('created_at', since).range(f, t)),
    admin.from('sparks').select('from_user_id').gte('created_at', since),
    admin.from('radar_links').select('user_id').gte('created_at', since).eq('is_deleted', false),
    admin.from('demos').select('user_id, status').in('status', ['confirmed', 'done']),
    admin.from('push_subscriptions').select('user_id'),
    admin.from('survey_responses').select('name, email, role, demo, demo_idea, learn_next, nominee_name').eq('survey', SURVEY_KEY),
    admin.from('nudges').select('email, sent_at').gte('sent_at', new Date(now - 90 * DAY).toISOString()).order('sent_at', { ascending: false }),
  ])

  const count = <T,>(rows: T[] | null | undefined, key: (r: T) => string | null | undefined) => {
    const m = new Map<string, number>()
    for (const r of rows ?? []) { const k = key(r); if (k) m.set(k, (m.get(k) ?? 0) + 1) }
    return m
  }
  const namedTopics = count(topics.filter(t => !t.is_anonymous), t => t.user_id)
  const allTopics = count(topics, t => t.user_id)
  const namedComments = count(comments.filter(c => !c.is_anonymous), c => c.user_id)
  const allComments = count(comments, c => c.user_id)
  const voteCount = count(votes, v => v.user_id)
  const sparkCount = count(sparks, s => s.from_user_id)
  const radarCount = count(radar, r => r.user_id)
  const demoCount = count(demos, d => d.user_id)
  const pushSubs = new Set((subs ?? []).map(s => s.user_id))

  const visitsBy = new Map<string, typeof visits>()
  for (const v of visits) { const list = visitsBy.get(v.user_id) ?? []; list.push(v); visitsBy.set(v.user_id, list) }

  const lastNudge = new Map<string, string>()
  for (const n of nudges ?? []) if (!lastNudge.has(n.email)) lastNudge.set(n.email, n.sent_at)
  const surveyBy = new Map((survey ?? []).map(s => [s.email, s]))
  const nudgeOpen = (email: string) => {
    const last = lastNudge.get(email)
    return !last || now - new Date(last).getTime() > NUDGE_GAP_DAYS * DAY
  }

  const memberEmails = new Set<string>()
  const people: Person[] = (users ?? []).map(u => {
    const email = (u.email ?? '').toLowerCase()
    memberEmails.add(email)
    const vs = visitsBy.get(u.id) ?? []
    const recent = vs.filter(v => v.day >= since30)
    const lastDay = vs.length ? vs[vs.length - 1].day : null
    const s = surveyBy.get(email)
    const score =
      recent.length +
      (voteCount.get(u.id) ?? 0) +
      (allComments.get(u.id) ?? 0) * 2 +
      (allTopics.get(u.id) ?? 0) * 4 +
      (radarCount.get(u.id) ?? 0) * 2 +
      (sparkCount.get(u.id) ?? 0) +
      (demoCount.get(u.id) ?? 0) * 6
    return {
      key: u.id,
      userId: u.id,
      member: true,
      name: u.real_name || `@${u.username}`,
      username: u.username,
      email,
      isAdmin: u.role === 'admin',
      isViewer: u.role === 'viewer',
      joined: u.created_at,
      level: levelOf(score),
      lastSeen: lastDay,
      daysActive30: recent.length,
      wentQuiet: !recent.length && vs.length > 0,
      app: recent.some(v => v.app),
      push: pushSubs.has(u.id),
      namedPosts: namedTopics.get(u.id) ?? 0,
      namedComments: namedComments.get(u.id) ?? 0,
      votes: voteCount.get(u.id) ?? 0,
      demos: demoCount.get(u.id) ?? 0,
      survey: s ? { demo: s.demo, demoIdea: s.demo_idea, learnNext: s.learn_next, nominated: s.nominee_name } : null,
      nudgesOff: u.nudges_off === true,
      lastNudged: lastNudge.get(email) ?? null,
      canNudge: u.nudges_off !== true && nudgeOpen(email),
    }
  })

  // Survey answerers without an account: at the door, reachable by Slack.
  for (const s of survey ?? []) {
    if (memberEmails.has(s.email)) continue
    people.push({
      key: `survey:${s.email}`,
      userId: null,
      member: false,
      name: s.name,
      username: null,
      email: s.email,
      isAdmin: false,
      isViewer: false,
      joined: null,
      level: 'quiet',
      lastSeen: null,
      daysActive30: 0,
      wentQuiet: false,
      app: false,
      push: false,
      namedPosts: 0,
      namedComments: 0,
      votes: 0,
      demos: 0,
      survey: { demo: s.demo, demoIdea: s.demo_idea, learnNext: s.learn_next, nominated: s.nominee_name },
      nudgesOff: false,
      lastNudged: lastNudge.get(s.email) ?? null,
      canNudge: nudgeOpen(s.email),
    })
  }

  return { people }
}
