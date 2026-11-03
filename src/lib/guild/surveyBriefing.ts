import { JOIN_REASONS, MEETING_SLOTS, ROLES, labelOf } from '@/lib/survey'
import { pct, surveyStats } from '@/lib/surveyStats'
import type { SurveyRow } from '@/lib/surveyResults'

/**
 * Kers reading the survey: the totals and the standout answer per question,
 * as facts he may quote, plus what to do about them. Counts only, no names.
 */
export function surveyBriefing(rows: SurveyRow[]) {
  const stats = surveyStats(rows)
  const top = (key: string) => stats.questions.find(q => q.key === key)?.bars[0]
  const reason = top('join')
  const slot = top('slot')
  const role = top('role')
  const nominations = rows.filter(r => r.nominee_name).length

  const facts = {
    answers: stats.total,
    without_an_account: stats.newVoices,
    could_show_something: stats.couldDemo,
    spotlight_nominations: nominations,
    top_reason_to_join: reason ? labelOf(JOIN_REASONS, reason.value) : null,
    top_reason_share: reason ? pct(reason.share) : null,
    best_meeting_time: slot ? labelOf(MEETING_SLOTS, slot.value) : null,
    most_answers_from: role ? labelOf(ROLES, role.value) : null,
  }
  const actions = [
    reason ? `Build the next meeting around "${facts.top_reason_to_join}"` : '',
    stats.couldDemo ? `Book the ${stats.couldDemo} people who could show something into demo slots` : '',
    stats.newVoices ? `Invite the ${stats.newVoices} who answered without an account` : '',
    nominations ? `Turn the ${nominations} Spotlight nominations into invitations` : '',
  ].filter(Boolean)

  const fallback = stats.total
    ? `${stats.total} answers in. ${reason ? `"${facts.top_reason_to_join}" wins with ${facts.top_reason_share}, so that's the brief.` : ''} ${actions[0] ? `${actions[0]}.` : ''}`.replace(/\s+/g, ' ').trim()
    : 'No answers yet. I refreshed this page so you don’t have to. Share the link in Slack.'
  return { facts, actions, fallback }
}
