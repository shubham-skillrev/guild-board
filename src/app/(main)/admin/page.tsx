import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getStaff } from '@/lib/guild/staff'
import { getPulseFacts, pulseActions, pulseFallback } from '@/lib/guild/pulse'
import { readBriefing } from '@/lib/guild/kers'
import { KersBriefing } from '@/components/admin/pulse/KersBriefing'
import { ActionNotes } from '@/components/admin/pulse/ActionNotes'
import { Figure, Trend } from '@/components/admin/pulse/Trend'
import { SectionHeader } from '@/components/ui/Section'

export const metadata: Metadata = { title: 'Pulse' }

function weekLabel(day: string): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

/**
 * Pulse: Kers' read of the guild, this week's to-dos, the headline numbers
 * and the trend. A team lead sees the same page for their own team, minus
 * the to-dos and anything about a single person.
 */
export default async function PulsePage() {
  const staff = await getStaff()
  if (!staff) notFound()
  const teamId = staff.isAdmin ? undefined : staff.leadTeam?.id

  const facts = await getPulseFacts(teamId)
  const actions = teamId ? [] : pulseActions(facts)
  const scope = teamId ? `team:${teamId}` : 'pulse'
  const briefing = await readBriefing(scope, pulseFallback(facts, actions))

  const pct = (n: number) => (facts.members ? `${Math.round((n / facts.members) * 100)}% of ${teamId ? 'the team' : 'members'}` : undefined)

  return (
    <div className="space-y-12">
      <KersBriefing scope={teamId ? 'team' : 'pulse'} initial={briefing} />

      {!teamId && (
        <section aria-labelledby="pulse-todo">
          <SectionHeader id="pulse-todo" title="On the desk this week" hint="Worked out from the numbers; each note goes where it gets done." />
          <div className="pt-2">
            <ActionNotes notes={actions.slice(0, 6)} />
          </div>
        </section>
      )}

      <section aria-labelledby="pulse-numbers">
        <SectionHeader id="pulse-numbers" title={teamId ? 'Your team' : 'The guild'} hint={facts.cycle ? `${facts.cycle.label}${facts.cycle.daysToMeeting != null && facts.cycle.daysToMeeting >= 0 ? ` · meeting in ${facts.cycle.daysToMeeting} day${facts.cycle.daysToMeeting === 1 ? '' : 's'}` : ''}` : undefined} />
        <div className="grid gap-3 grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          <Figure label="Members" value={facts.members} sub={facts.joined30 ? `${facts.joined30} new this month` : 'none new this month'} />
          <Figure label="Active, 30 days" value={facts.active30} sub={pct(facts.active30)} />
          <Figure label="Active, 7 days" value={facts.active7} />
          <Figure label="Use the app" value={facts.appUsers} sub="opened as installed app" />
          <Figure label="Notifications on" value={facts.pushOn} sub={pct(facts.pushOn)} />
          <Figure label="Survey answers" value={facts.survey.answers} sub={facts.survey.noAccount ? `${facts.survey.noAccount} without an account` : undefined} />
        </div>
        {facts.cycle && (
          <p className="mt-3 text-footnote text-ink-muted">
            This month: {facts.cycle.topics} topic{facts.cycle.topics === 1 ? '' : 's'}, {facts.cycle.comments} comment{facts.cycle.comments === 1 ? '' : 's'}
            {!teamId && <>, {facts.cycle.votes} vote{facts.cycle.votes === 1 ? '' : 's'}, {facts.radar} Radar link{facts.radar === 1 ? '' : 's'}</>}.
            Show & Tell: Spotlight {facts.showTell.spotlight ? 'booked' : 'open'}, demo {facts.showTell.demo ? 'booked' : 'open'}.
          </p>
        )}
      </section>

      <section aria-labelledby="pulse-trend" className="grid gap-4 md:grid-cols-2">
        <h2 id="pulse-trend" className="sr-only">Trends</h2>
        <Trend title="Active members per week" unit="active" points={facts.weeks.map(w => ({ label: weekLabel(w.week), value: w.active }))} />
        <Trend title="New members per week" unit="joined" points={facts.weeks.map(w => ({ label: weekLabel(w.week), value: w.joined }))} />
      </section>

      {!teamId && (
        <p className="text-footnote text-ink-muted">
          Who’s behind the numbers: <Link href="/admin/people" className="text-ink underline decoration-border-strong underline-offset-2 hover:decoration-ink">the guild hall</Link>.
          Visits are counted from the day migration 038 went live, so the trend fills in over the coming weeks.
        </p>
      )}
    </div>
  )
}
