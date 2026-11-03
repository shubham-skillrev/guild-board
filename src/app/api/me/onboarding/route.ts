// ROUTE: GET /api/me/onboarding
// AUTH: members (guests and older members get { show: false })
// PURPOSE: The getting-started checklist for a member's first two weeks:
//          answered the survey, voted, said something (a topic or comment,
//          their own ghost ones included: it's their checklist), turned on
//          notifications, opened the installed app.
// DB TABLES: users, survey_responses, votes, topics, comments,
//            push_subscriptions, user_visits

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SURVEY_KEY } from '@/lib/survey'
import { isNewMember, type Onboarding } from '@/lib/onboarding'

const NONE: Onboarding = { show: false, done: { survey: false, vote: false, speak: false, notifications: false, app: false } }

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json(NONE)

  const admin = createAdminClient()
  const { data: me } = await admin.from('users').select('created_at, email').eq('id', user.id).maybeSingle()
  if (!me || !isNewMember(me.created_at)) return NextResponse.json(NONE)

  const head = { count: 'exact' as const, head: true }
  const [survey, votes, topics, comments, subs, app] = await Promise.all([
    admin.from('survey_responses').select('id', head).eq('survey', SURVEY_KEY).eq('email', (me.email ?? '').toLowerCase()),
    admin.from('votes').select('id', head).eq('user_id', user.id),
    admin.from('topics').select('id', head).eq('user_id', user.id).eq('is_deleted', false),
    admin.from('comments').select('id', head).eq('user_id', user.id).eq('is_deleted', false),
    admin.from('push_subscriptions').select('id', head).eq('user_id', user.id),
    admin.from('user_visits').select('day', head).eq('user_id', user.id).eq('app', true),
  ])
  const done = {
    survey: (survey.count ?? 0) > 0,
    vote: (votes.count ?? 0) > 0,
    speak: (topics.count ?? 0) + (comments.count ?? 0) > 0,
    notifications: (subs.count ?? 0) > 0,
    app: (app.count ?? 0) > 0,
  }
  return NextResponse.json(
    { show: !Object.values(done).every(Boolean), done } satisfies Onboarding,
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}
