'use client'

import { Bell, DeviceMobile } from '@phosphor-icons/react/dist/ssr'
import { cn } from '@/lib/utils/cn'
import { CircleHall } from '@/components/hall/CircleHall'
import { isNewMember } from '@/lib/onboarding'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { levelLabel, type Person } from '@/lib/people'

function seen(day: string | null): string {
  if (!day) return 'not seen yet'
  const days = Math.round((Date.now() - new Date(`${day}T12:00:00+05:30`).getTime()) / 86_400_000)
  return days <= 0 ? 'here today' : days === 1 ? 'here yesterday' : `last here ${days} days ago`
}

/**
 * The guild as one round group: the more involved someone is, the bigger they are and
 * the nearer the middle; new members are ringed; people who answered the survey without an account wait at
 * the door. Pick someone (or a person at the door) to see them and nudge.
 */
export function GuildHall({
  people,
  selected,
  onToggle,
}: {
  people: Person[]
  selected: Set<string>
  onToggle: (key: string) => void
}) {
  const members = people.filter(p => p.member)
  const outside = people.filter(p => !p.member)

  return (
    <div>
      {members.length === 0 ? (
        <p className="rounded-(--radius-card) border border-dashed border-border-strong p-8 text-center text-footnote text-ink-muted">No members match.</p>
      ) : (
        <CircleHall
          items={members.map(p => ({
            key: p.key,
            level: p.level,
            seed: p.username ?? p.email,
            name: p.username ? `${p.name} (@${p.username})` : p.name,
            isNew: isNewMember(p.joined),
            label: `${p.name}, ${levelLabel(p.level)}, ${seen(p.lastSeen)}${p.app ? ', uses the app' : ''}${p.push ? ', notifications on' : ''}`,
            selected: selected.has(p.key),
            app: p.app,
            push: p.push,
            onClick: () => onToggle(p.key),
          }))}
        />
      )}

      {/* The street: people at the door. */}
      {outside.length > 0 && (
        <div className="mt-4 rounded-(--radius-card) border border-dashed border-border-strong px-4 py-3">
          <p className="text-meta text-ink-muted">At the door · answered the survey, no account yet</p>
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {outside.map(p => {
              const on = selected.has(p.key)
              return (
                <li key={p.key}>
                  <button
                    type="button"
                    onClick={() => onToggle(p.key)}
                    aria-pressed={on}
                    className={cn(
                      'press-sm inline-flex h-8 items-center gap-1.5 rounded-full border pl-1.5 pr-3 text-footnote transition-colors',
                      on ? 'border-ink bg-ink text-parchment' : 'border-border bg-paper text-ink-soft hover:text-ink',
                    )}
                  >
                    <UserAvatar username={p.email} size={18} />
                    {p.name}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* What the badges mean. */}
      <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-meta text-ink-muted">
        <li className="inline-flex items-center gap-1"><DeviceMobile className="size-3" weight="bold" aria-hidden /> uses the app</li>
        <li className="inline-flex items-center gap-1"><Bell className="size-3" weight="bold" aria-hidden /> notifications on</li>
        <li>Bigger and nearer the middle = more involved · mint ring = joined in the last two weeks</li>
      </ul>
      <p className="mt-1.5 text-meta text-ink-muted">
        Levels blend visits, votes, comments, posts (anonymous ones too) and demos over 60 days. No number behind them is shown.
      </p>
    </div>
  )
}
