// ROUTE: GET /api/survey/status
// AUTH: none (guests get the generic answer)
// PURPOSE: What the board's survey card needs: is the survey open, and has
//          this member already answered it (matched by email, so an answer
//          typed before they signed up still counts).
// DB TABLES: surveys, survey_responses
// RLS: server client for identity; admin client for reads (no member grants)

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SURVEY_KEY } from '@/lib/survey'
import { getSurveyState } from '@/lib/surveyResults'
import { isNewMember } from '@/lib/onboarding'

export async function GET() {
  const state = await getSurveyState()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let answered = false
  let newMember = false
  if (state.open && user?.email) {
    const { data: me } = await createAdminClient().from('users').select('created_at').eq('id', user.id).maybeSingle()
    newMember = isNewMember(me?.created_at)
    const { data } = await createAdminClient()
      .from('survey_responses')
      .select('id')
      .eq('survey', SURVEY_KEY)
      .eq('email', user.email.toLowerCase())
      .maybeSingle()
    answered = !!data
  }

  return NextResponse.json(
    // A member's first two weeks: the getting-started card asks instead.
    { survey: SURVEY_KEY, open: state.open, answered, member: !!user, newMember },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}
