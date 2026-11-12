'use client'

import { cn } from '@/lib/utils/cn'
import type { Segment } from '@/lib/meeting'

/**
 * Where the meeting is: one thin line with a dot per segment, evenly spaced
 * (the meeting is paced by the presenter, not by planned minutes). No text:
 * the line fills up to the current dot, which is the larger one. The
 * presenter can click a dot to jump; each dot's segment title is its
 * accessible name and its tooltip.
 */
export function AgendaProgress({
  agenda,
  index,
  onPick,
  className,
}: {
  agenda: Segment[]
  index: number
  /** Jump to a segment (the presenter only). */
  onPick?: (i: number) => void
  className?: string
}) {
  const n = agenda.length
  const fill = n > 1 ? (index / (n - 1)) * 100 : 100

  return (
    <nav aria-label="Agenda" className={cn('relative h-6', className)}>
      {/* The track and its fill, centred on the dots. */}
      <div aria-hidden className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-border-strong" />
      <div
        aria-hidden
        className="absolute left-0 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-ink/70 transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
        style={{ width: `${fill}%` }}
      />
      <ol className="absolute inset-0 flex items-center justify-between">
        {agenda.map((s, i) => {
          const Tag = onPick ? 'button' : 'span'
          const now = i === index
          return (
            <li key={s.id} className="relative flex size-6 items-center justify-center first:-ml-3 last:-mr-3">
              <Tag
                {...(onPick ? { type: 'button' as const, onClick: () => onPick(i) } : {})}
                aria-current={now ? 'step' : undefined}
                aria-label={`${i + 1}. ${s.title}`}
                title={s.title}
                className={cn('group flex size-6 items-center justify-center rounded-full', onPick && 'press-sm cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink')}
              >
                <span
                  aria-hidden
                  className={cn(
                    'block rounded-full transition-[width,height,background-color,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
                    now
                      ? 'size-3 bg-ink shadow-[0_0_0_5px_color-mix(in_oklab,var(--color-ink)_12%,transparent)]'
                      : i < index
                        ? 'size-2 bg-ink/70'
                        : 'size-2 border border-border-strong bg-parchment',
                    onPick && !now && 'group-hover:bg-ink/40',
                  )}
                />
              </Tag>
            </li>
          )
        })}
      </ol>
    </nav>
  )
}
