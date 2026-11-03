import type { Person } from '@/lib/people'

/**
 * What Kers is told about the People tab: counts by level and by who can be
 * reached, never a name. Shared by the page and the "ask again" route.
 */
export function peopleBriefing(people: Person[]) {
  const members = people.filter(p => p.member)
  const facts = {
    members: members.length,
    driving_it: members.filter(p => p.level === 'driving').length,
    regulars: members.filter(p => p.level === 'regular').length,
    showing_up: members.filter(p => p.level === 'showing_up').length,
    quiet: members.filter(p => p.level === 'quiet').length,
    went_quiet_this_month: members.filter(p => p.wentQuiet).length,
    survey_without_account: people.filter(p => !p.member).length,
    could_show_something: people.filter(p => p.survey?.demo === 'yes' || p.survey?.demo === 'maybe').length,
    can_be_nudged_now: people.filter(p => p.canNudge).length,
  }
  const actions = [
    facts.survey_without_account ? `Invite the ${facts.survey_without_account} survey people waiting at the door` : '',
    facts.could_show_something ? `Ask the ${facts.could_show_something} who could show something to take a demo slot` : '',
    facts.went_quiet_this_month ? `Send a friendly note to the ${facts.went_quiet_this_month} who went quiet` : '',
  ].filter(Boolean)
  const lit = facts.driving_it + facts.regulars
  const fallback =
    `${lit} of ${facts.members} windows are properly lit, ${facts.quiet} are dark.` +
    (actions[0] ? ` ${actions[0]}.` : ' Everyone who can be reached has been. Look at you.')
  return { facts, actions, fallback }
}
