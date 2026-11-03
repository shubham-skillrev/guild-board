// ROUTE: /admin/survey
// AUTH: admin only (the proxy already 404s everyone else; checked again here)
// PURPOSE: Survey results: totals for the meeting, the people to follow up
//          with, and exports (image of the totals, PDF of the page, CSV).
// DB TABLES: survey_responses, users

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSurveyRows } from '@/lib/surveyResults'
import { SurveyDashboard } from '@/components/admin/SurveyDashboard'

export const metadata: Metadata = { title: 'Survey results' }

export default async function SurveyResultsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) notFound()
  const { data: me } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') notFound()

  const rows = await getSurveyRows()

  return (
    <div className="px-(--pad-page-x) py-8 w-full max-w-(--measure-wide) mx-auto pb-28 md:pb-10">
      <SurveyDashboard rows={rows} generatedAt={new Date().toISOString()} />
    </div>
  )
}
