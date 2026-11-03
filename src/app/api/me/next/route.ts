// ROUTE: GET /api/me/next
// AUTH: anyone; guests get the survey (if open) and nothing else
// PURPOSE: The board's one Kers card: everything this person could do next,
//          most important first. The board shows the top one; "Not now"
//          moves to the next.
// DB TABLES: users, demos, nudges, survey_responses, surveys, radar_links,
//            topics, comments, votes, push_subscriptions, user_visits

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSurveyState } from '@/lib/surveyResults'
import { nextSteps, type Step } from '@/lib/guild/nextSteps'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  let steps: Step[] = []
  if (user) steps = await nextSteps(user.id)
  else if ((await getSurveyState()).open) steps = [{ kind: 'survey' }]
  return NextResponse.json({ steps }, { headers: { 'Cache-Control': 'private, no-store' } })
}
