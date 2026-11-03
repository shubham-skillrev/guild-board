import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { SURVEY_KEY } from '@/lib/survey'

export interface MyYear {
  year: string
  daysHere: number
  posts: number
  comments: number
  votes: number
  sparksGiven: number
  demos: number
  radar: number
  answeredSurvey: boolean
}

/**
 * One member's own year in the guild, for their profile. Includes their
 * anonymous posts and comments: it's their own page, and they know which
 * are theirs. Never shown to anyone else.
 */
export async function getMyYear(userId: string, email: string): Promise<MyYear> {
  const admin = createAdminClient()
  const year = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).slice(0, 4)
  const from = `${year}-01-01T00:00:00+05:30`
  const head = { count: 'exact' as const, head: true }

  const [days, posts, comments, votes, sparks, demos, radar, survey] = await Promise.all([
    admin.from('user_visits').select('day', head).eq('user_id', userId).gte('day', `${year}-01-01`),
    admin.from('topics').select('id', head).eq('user_id', userId).eq('is_deleted', false).gte('created_at', from),
    admin.from('comments').select('id', head).eq('user_id', userId).eq('is_deleted', false).gte('created_at', from),
    admin.from('votes').select('id', head).eq('user_id', userId).gte('created_at', from),
    admin.from('sparks').select('id', head).eq('from_user_id', userId).gte('created_at', from),
    admin.from('demos').select('id', head).eq('user_id', userId).in('status', ['confirmed', 'done']).gte('created_at', from),
    admin.from('radar_links').select('id', head).eq('user_id', userId).eq('is_deleted', false).gte('created_at', from),
    admin.from('survey_responses').select('id', head).eq('survey', SURVEY_KEY).eq('email', email.toLowerCase()),
  ])

  return {
    year,
    daysHere: days.count ?? 0,
    posts: posts.count ?? 0,
    comments: comments.count ?? 0,
    votes: votes.count ?? 0,
    sparksGiven: sparks.count ?? 0,
    demos: demos.count ?? 0,
    radar: radar.count ?? 0,
    answeredSurvey: (survey.count ?? 0) > 0,
  }
}

/** Kers' line about it: one observation, one nudge, never a guilt trip. */
export function myYearLine(y: MyYear): string {
  const said = y.posts + y.comments
  if (y.demos > 0) return `You've stood up and shown something this year. I clapped. Nobody saw, but I clapped.`
  if (said >= 10) return `${said} posts and comments this year. You're half the reason I have anything to narrate. Next step: the demo slot.`
  if (y.votes >= 5 && said === 0) return `${y.votes} votes and not a word. A mysterious curator. Try one comment, I promise it doesn't bite.`
  if (said > 0) return `You've joined in ${said} time${said === 1 ? '' : 's'} this year. Small, steady, respectable. Got something to show at a meeting?`
  if (!y.answeredSurvey) return `Fresh profile, big potential. Start with the two-minute survey, then tell the guild what you want to hear about.`
  return `Quiet so far. That's allowed. When something at work surprises you, that's a topic. Post it.`
}
