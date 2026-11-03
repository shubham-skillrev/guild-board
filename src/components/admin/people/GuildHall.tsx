'use client'

import { Bell, DeviceMobile } from '@phosphor-icons/react/dist/ssr'
import { cn } from '@/lib/utils/cn'
import { LEVELS, levelLabel, type ActivityLevel, type Person } from '@/lib/people'

/* Window glass by activity, the same lit-window language as /hours: dark
   glass for quiet, a dim lamp, a warm lamp, and a bright one that spills. */
const GLASS: Record<ActivityLevel, string> = {
  quiet: 'bg-[#1b2030] text-white/55',
  showing_up: 'bg-gradient-to-b from-[#8a7550] to-[#5e5038] text-white/85',
  regular: 'bg-gradient-to-b from-[#FFE3A3] to-[#F2A84B] text-[#3a2a12]',
  driving: 'bg-gradient-to-b from-[#FFF1C9] to-[#FFC56B] text-[#3a2a12] shadow-[0_0_18px_4px_rgba(255,200,110,0.55)]',
}

function initials(name: string): string {
  const parts = name.replace(/^@/, '').split(/[\s._-]+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?'
}

function seen(day: string | null): string {
  if (!day) return 'not seen yet'
  const days = Math.round((Date.now() - new Date(`${day}T12:00:00+05:30`).getTime()) / 86_400_000)
  return days <= 0 ? 'here today' : days === 1 ? 'here yesterday' : `last here ${days} days ago`
}

/**
 * The guild as a building: every member is a window, lit by how involved
 * they are; people who answered the survey without an account wait at the
 * door. Click a window (or a person at the door) to see them and nudge.
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
      <div className="rounded-t-[28px] rounded-b-[10px] border border-[#3a2e22]/30 bg-[#e9dcc6] p-4 shadow-[0_18px_40px_var(--shadow-tint)] dark:bg-[#2a2c3a] dark:border-black/40 sm:p-6">
        {/* Roofline. */}
        <div aria-hidden className="-mt-1 mb-4 flex items-center justify-center gap-2 text-[11px] font-mono uppercase tracking-[0.2em] text-[#5a4630] dark:text-white/50">
          <span className="h-px flex-1 bg-current opacity-30" />
          The guild hall · {members.length} windows
          <span className="h-px flex-1 bg-current opacity-30" />
        </div>
        {members.length === 0 ? (
          <p className="py-8 text-center text-footnote text-[#5a4630] dark:text-white/60">No members match.</p>
        ) : (
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(52px,1fr))] gap-2.5 sm:gap-3">
            {members.map(p => {
              const on = selected.has(p.key)
              return (
                <li key={p.key}>
                  <button
                    type="button"
                    onClick={() => onToggle(p.key)}
                    aria-pressed={on}
                    aria-label={`${p.name}, ${levelLabel(p.level)}, ${seen(p.lastSeen)}${p.app ? ', uses the app' : ''}${p.push ? ', notifications on' : ''}`}
                    title={`${p.name} · ${levelLabel(p.level)} · ${seen(p.lastSeen)}`}
                    className={cn(
                      'group relative grid aspect-[5/6] w-full place-items-center rounded-[6px] border-[3px] border-[#3a2e22] text-[12px] font-semibold tracking-wide transition-transform',
                      'hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink',
                      GLASS[p.level],
                      on && 'ring-2 ring-offset-2 ring-ink ring-offset-[#e9dcc6] dark:ring-offset-[#2a2c3a]',
                    )}
                  >
                    {/* The cross bar of the window frame. */}
                    <span aria-hidden className="absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-[#3a2e22]/40" />
                    <span className="relative">{initials(p.name)}</span>
                    {(p.app || p.push) && (
                      <span aria-hidden className="absolute -bottom-2 left-1/2 flex -translate-x-1/2 gap-0.5 rounded-full bg-paper px-1 py-0.5 text-ink-muted shadow-sm">
                        {p.app && <DeviceMobile className="size-2.5" weight="bold" />}
                        {p.push && <Bell className="size-2.5" weight="bold" />}
                      </span>
                    )}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

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
                      'press-sm inline-flex h-8 items-center rounded-full border px-3 text-footnote transition-colors',
                      on ? 'border-ink bg-ink text-parchment' : 'border-border bg-paper text-ink-soft hover:text-ink',
                    )}
                  >
                    {p.name}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* Legend: four lamp levels, plus what the badges mean. */}
      <ul className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-meta text-ink-muted">
        {LEVELS.map(l => (
          <li key={l.value} className="inline-flex items-center gap-1.5">
            <span aria-hidden className={cn('size-3 rounded-[3px] border border-[#3a2e22]', GLASS[l.value], 'shadow-none')} />
            {l.label}
          </li>
        ))}
        <li className="inline-flex items-center gap-1"><DeviceMobile className="size-3" weight="bold" aria-hidden /> uses the app</li>
        <li className="inline-flex items-center gap-1"><Bell className="size-3" weight="bold" aria-hidden /> notifications on</li>
      </ul>
      <p className="mt-1.5 text-meta text-ink-muted">
        Levels blend visits, votes, comments, posts (anonymous ones too) and demos over 60 days. No number behind them is shown.
      </p>
    </div>
  )
}
