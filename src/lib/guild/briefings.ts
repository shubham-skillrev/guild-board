import 'server-only'
import type { Facts } from '@/lib/guild/kers'
import { getPulseFacts, kersFacts, pulseActions, pulseFallback } from '@/lib/guild/pulse'
import { getPeople } from '@/lib/guild/people'
import { peopleBriefing } from '@/lib/guild/peopleBriefing'
import { surveyBriefing } from '@/lib/guild/surveyBriefing'
import { getSurveyRows } from '@/lib/surveyResults'

export interface BriefingInputs {
  /** Cache key prefix: 'pulse', 'team:<id>', 'survey', 'people'. */
  scope: string
  facts: Facts
  actions: string[]
  fallback: string
}

/**
 * What Kers is told for each briefing, in one place, so the page, the
 * "ask again" button and the daily cron all hand him the same facts.
 */
export async function briefingInputs(scope: string, teamId?: string): Promise<BriefingInputs | null> {
  if (scope === 'pulse' || (scope === 'team' && teamId)) {
    const facts = await getPulseFacts(scope === 'team' ? teamId : undefined)
    const actions = scope === 'team' ? [] : pulseActions(facts)
    return {
      scope: scope === 'team' ? `team:${teamId}` : 'pulse',
      facts: kersFacts(facts),
      actions: actions.map(a => a.text),
      fallback: pulseFallback(facts, actions),
    }
  }
  if (scope === 'survey') {
    return { scope: 'survey', ...surveyBriefing(await getSurveyRows()) }
  }
  if (scope === 'people') {
    const { people } = await getPeople()
    return { scope: 'people', ...peopleBriefing(people) }
  }
  return null
}
