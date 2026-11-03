// ROUTE: /admin/survey
// AUTH: admin only (the proxy already 404s everyone else; checked again here)
// PURPOSE: Survey results: totals for the meeting, the people to follow up
//          with, and exports (image of the totals, PDF of the page, CSV).
// DB TABLES: survey_responses, users

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSurveyRows, getSurveyState } from '@/lib/surveyResults'
import { SurveyDashboard } from '@/components/admin/SurveyDashboard'

export const metadata: Metadata = { title: 'Survey results' }

export default async function SurveyResultsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()
  const { data: me } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') notFound()

  const [rows, state] = await Promise.all([getSurveyRows(), getSurveyState()])

  return <SurveyDashboard rows={rows} state={state} generatedAt={new Date().toISOString()} />
}
