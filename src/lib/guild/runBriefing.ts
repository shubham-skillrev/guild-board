import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { openCycle, slotsFor } from '@/lib/guild/demos'
import { getMeeting } from '@/lib/guild/meeting'

const DAY = 86_400_000

/** Kers on the Run tab: where the month is, and what the meeting still needs. */
export async function runBriefing() {
  const admin = createAdminClient()
  const cycle = await openCycle(admin)
  if (!cycle) {
    return { facts: { month: null }, actions: ['Open the next month'], fallback: 'No month is open. The board is a ghost town, and not the fun anonymous kind. Open the next month.' }
  }
  const [m, slots, { count: picked }] = await Promise.all([
    getMeeting(cycle.id),
    slotsFor(admin, cycle.id),
    admin.from('topics').select('id', { count: 'exact', head: true }).eq('cycle_id', cycle.id).eq('is_selected', true).eq('is_deleted', false),
  ])
  const days = cycle.meeting_at ? Math.ceil((new Date(cycle.meeting_at).getTime() - Date.now()) / DAY) : null
  const facts = {
    month: cycle.label,
    days_to_meeting: days,
    agenda_ready: m.agenda.length > 0,
    agenda_posted: !!m.agendaPostedAt,
    call_link_set: !!m.meetUrl,
    spotlight_booked: !!slots.spotlight,
    demo_booked: !!slots.demo,
    topics_picked: picked ?? 0,
    recap_posted: !!m.recapPostedAt,
  }
  const actions = [
    !m.agenda.length ? 'Build the agenda from the board' : '',
    !m.meetUrl ? 'Add the call link' : '',
    m.agenda.length && !m.agendaPostedAt ? 'Post the agenda to Slack' : '',
    m.endedAt && !m.recapPostedAt ? 'Post the recap' : '',
  ].filter(Boolean)
  const lead = days == null
    ? `${cycle.label} has no meeting date. Bold.`
    : days < 0
      ? `${cycle.label}'s meeting was ${-days} day${days === -1 ? '' : 's'} ago.`
      : `${cycle.label} meets in ${days} day${days === 1 ? '' : 's'}.`
  const fallback = `${lead} ${actions[0] ? `Next: ${actions[0].toLowerCase()}.` : 'Everything is lined up. I am almost disappointed.'}`
  return { facts, actions, fallback }
}

/** Kers on the Topics tab: what's on the board and what's been picked. */
export async function topicsBriefing() {
  const admin = createAdminClient()
  const cycle = await openCycle(admin)
  if (!cycle) return { facts: { month: null }, actions: [], fallback: 'No open month, no topics. I am narrating an empty room.' }
  const { data } = await admin.from('topics').select('vote_count, is_selected, outcome_tag').eq('cycle_id', cycle.id).eq('is_deleted', false).eq('is_system', false)
  const ts = data ?? []
  const facts = {
    month: cycle.label,
    topics: ts.length,
    picked_for_meeting: ts.filter(t => t.is_selected).length,
    with_an_outcome: ts.filter(t => t.outcome_tag).length,
    most_votes: ts.reduce((n, t) => Math.max(n, t.vote_count ?? 0), 0),
  }
  const actions = [
    !facts.picked_for_meeting && facts.topics ? 'Pick the topics for the meeting' : '',
    facts.topics < 3 ? 'Nudge people to post: the board is thin' : '',
  ].filter(Boolean)
  const fallback = facts.topics
    ? `${facts.topics} topic${facts.topics === 1 ? '' : 's'} on the board, ${facts.picked_for_meeting} picked. ${actions[0] ? `${actions[0]}.` : 'Drag the rest along after the meeting.'}`
    : 'The board is empty. A blank canvas, or a cry for help. Post a topic to break the ice.'
  return { facts, actions, fallback }
}
