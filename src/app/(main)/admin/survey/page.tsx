// ROUTE: /admin/survey
// AUTH: admin only (the proxy already 404s everyone else; checked again here)
// PURPOSE: Survey results: Kers' read, totals for the meeting, the people to
//          follow up with, the open/closed switch, and exports (image of the
//          totals, PDF of the page, CSV).
// DB TABLES: survey_responses, surveys, users, kers_briefings

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getStaff } from '@/lib/guild/staff'
import { getSurveyRows, getSurveyState } from '@/lib/surveyResults'
import { readBriefing } from '@/lib/guild/kers'
import { surveyBriefing } from '@/lib/guild/surveyBriefing'
import { SurveyDashboard } from '@/components/admin/SurveyDashboard'

export const metadata: Metadata = { title: 'Survey results' }

export default async function SurveyResultsPage() {
  const staff = await getStaff()
  if (!staff) notFound()
  const [rows, state] = await Promise.all([getSurveyRows(), getSurveyState()])
  const briefing = await readBriefing('survey', surveyBriefing(rows).fallback)
  return <SurveyDashboard rows={rows} state={state} briefing={briefing} readOnly={staff.readOnly} generatedAt={new Date().toISOString()} />
}
