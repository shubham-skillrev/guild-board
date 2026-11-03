// ROUTE: POST /api/survey
// AUTH: none (public). A session, when present, supplies a verified email.
// PURPOSE: Save one answer to the guild survey at /survey. One row per email
//          per survey: answering again replaces the earlier answer, except
//          that a typed (unverified) answer never replaces a signed-in one.
// DB TABLES: survey_responses, surveys, users
// RLS: server client for identity; admin client for the write (the table
//      has no anon or member grants, see migration 037)

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SURVEY_KEY, sanitizeAnswers } from '@/lib/survey'
import { getSurveyState } from '@/lib/surveyResults'
import { isAllowedEmailDomain } from '@/lib/utils/email'

export async function POST(request: Request) {
  let body: Record<string, unknown> = {}
  try { body = await request.json() } catch { /* empty body */ }

  // Honeypot: a field people never see. Bots that fill every input get a
  // quiet success and nothing is stored.
  if (typeof body.website === 'string' && body.website.trim()) {
    return NextResponse.json({ ok: true })
  }

  if (!(await getSurveyState()).open) {
    return NextResponse.json({ error: 'The survey is closed. The results go up at the next guild meeting.' }, { status: 403 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // Signed in: the email is Google's, never the typed one.
  const verified = !!user?.email && isAllowedEmailDomain(user.email)
  if (verified) body.email = user!.email

  const parsed = sanitizeAnswers(body)
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })
  const a = parsed.answers

  const admin = createAdminClient()

  if (!verified) {
    const { data: existing } = await admin
      .from('survey_responses')
      .select('verified')
      .eq('survey', SURVEY_KEY)
      .eq('email', a.email)
      .maybeSingle()
    if (existing?.verified) {
      return NextResponse.json(
        { error: 'This email already answered while signed in. Sign in with Google to change it.' },
        { status: 409 },
      )
    }
  }

  const { error } = await admin.from('survey_responses').upsert(
    {
      survey: SURVEY_KEY,
      email: a.email,
      name: a.name,
      user_id: verified ? user!.id : null,
      verified,
      role: a.role,
      attended: a.attended,
      join_reasons: a.join_reasons,
      join_other: a.join_other || null,
      learn_next: a.learn_next || null,
      demo: a.demo,
      demo_idea: a.demo_idea || null,
      nominee_name: a.nominee_name || null,
      nominee_why: a.nominee_why || null,
      meeting_slot: a.meeting_slot,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'survey,email' },
  )

  if (error) {
    console.error('survey upsert failed:', error)
    return NextResponse.json({ error: 'Could not save your answers. Try again in a minute.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
