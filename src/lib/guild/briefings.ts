import 'server-only'
import type { Facts } from '@/lib/guild/kers'
import { getPulseFacts, kersFacts, pulseActions, pulseFallback } from '@/lib/guild/pulse'
import { getPeople } from '@/lib/guild/people'
import { peopleBriefing } from '@/lib/guild/peopleBriefing'
import { surveyBriefing } from '@/lib/guild/surveyBriefing'
import { getSurveyRows } from '@/lib/surveyResults'
import { runBriefing, topicsBriefing } from '@/lib/guild/runBriefing'

export interface BriefingInputs {
  /** Cache key prefix: 'pulse', 'people', 'survey', 'run', 'topics'. */
  scope: string
  facts: Facts
  actions: string[]
  fallback: string
}

/**
 * What Kers is told for each briefing, in one place, so the page, the
 * "ask again" button and the daily cron all hand him the same facts.
 */
export async function briefingInputs(scope: string): Promise<BriefingInputs | null> {
  if (scope === 'pulse') {
    const facts = await getPulseFacts()
    const actions = pulseActions(facts)
    return {
      scope: 'pulse',
      facts: kersFacts(facts),
      actions: actions.map(a => a.text),
      fallback: pulseFallback(facts, actions),
    }
  }
  if (scope === 'run') return { scope: 'run', ...(await runBriefing()) }
  if (scope === 'topics') return { scope: 'topics', ...(await topicsBriefing()) }
  if (scope === 'survey') {
    return { scope: 'survey', ...surveyBriefing(await getSurveyRows()) }
  }
  if (scope === 'people') {
    const { people } = await getPeople()
    return { scope: 'people', ...peopleBriefing(people) }
  }
  return null
}
