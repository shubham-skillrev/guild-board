'use client'

import { cn } from '@/lib/utils/cn'
import { agendaProgress, type Segment } from '@/lib/meeting'

/**
 * Where the meeting is: a bar weighted by each segment's planned minutes
 * ("35% through"), and a row of segment dots under it, one per segment,
 * each sitting at its segment's start on the bar.
 */
export function AgendaProgress({
  agenda,
  index,
  secondsIn,
  onPick,
}: {
  agenda: Segment[]
  index: number
  secondsIn: number
  /** Jump to a segment (the presenter only). */
  onPick?: (i: number) => void
}) {
  const fraction = agendaProgress(agenda, index, secondsIn)
  const pct = Math.round(fraction * 100)

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between text-[15px] text-ink-muted">
        <span className="font-mono tabular">{pct}% through</span>
        {agenda[index + 1] && <span>Next: <span className="text-ink">{agenda[index + 1].title}</span></span>}
      </div>
      <div
        className="relative h-2 overflow-hidden rounded-full bg-kinu"
        role="progressbar"
        aria-label="Agenda progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <span className="absolute inset-y-0 left-0 rounded-full bg-ink transition-[width] duration-1000 ease-linear" style={{ width: `${fraction * 100}%` }} />
      </div>
      <ol className="flex gap-1.5">
        {agenda.map((s, i) => {
          const Tag = onPick ? 'button' : 'span'
          return (
            <li key={s.id} className="min-w-0" style={{ flex: `${s.minutes} 1 0%` }}>
              <Tag
                {...(onPick ? { type: 'button' as const, onClick: () => onPick(i) } : {})}
                aria-current={i === index ? 'step' : undefined}
                className={cn('flex w-full min-w-0 items-center gap-2 text-left text-[14px]', onPick && 'press-sm hover:text-ink')}
              >
                <span
                  aria-hidden
                  className={cn(
                    'size-2.5 shrink-0 rounded-full',
                    i < index ? 'bg-ink/45' : i === index ? 'bg-ink ring-4 ring-ink/12' : 'border border-border-strong bg-transparent',
                  )}
                />
                <span className={cn('truncate', i === index ? 'font-medium text-ink' : 'text-ink-muted')}>{s.title}</span>
              </Tag>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
