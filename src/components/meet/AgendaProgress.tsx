'use client'

import { cn } from '@/lib/utils/cn'
import { sectionsOf, type Segment } from '@/lib/meeting'

/**
 * Where the meeting is: one thin line per section, side by side with a gap
 * between them, and a small dot per slide on it. No text: the lines fill up
 * to the current dot, which is the larger one. Sections are as long as their
 * slides, so the gaps show the meeting's shape. The presenter can click a
 * dot to jump; each dot's slide is its accessible name and tooltip.
 */
export function AgendaProgress({
  agenda,
  index,
  onPick,
  className,
}: {
  agenda: Segment[]
  index: number
  /** Jump to a slide (the presenter only). */
  onPick?: (i: number) => void
  className?: string
}) {
  const sections = sectionsOf(agenda)
  return (
    <nav aria-label="Agenda" className={cn('flex h-6 items-center gap-3', className)}>
      {sections.map(sec => {
        const end = sec.start + sec.slides - 1
        const past = index > end
        const here = index >= sec.start && index <= end
        // The fill: the whole line once passed, up to the current dot while in it.
        const fill = past ? 100 : here && sec.slides > 1 ? ((index - sec.start) / (sec.slides - 1)) * 100 : 0
        return (
          <ol key={sec.start} aria-label={sec.title} className="relative flex h-6 min-w-0 items-center justify-between px-1" style={{ flexGrow: Math.max(1, sec.slides), flexBasis: 0 }}>
            <span aria-hidden className={cn('absolute inset-x-1 top-1/2 h-px -translate-y-1/2', past ? 'bg-ink/50' : 'bg-border-strong')} />
            <span
              aria-hidden
              className="absolute left-1 top-1/2 h-0.5 -translate-y-1/2 rounded-full bg-ink/70 transition-[width] duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none"
              style={{ width: `calc((100% - 0.5rem) * ${fill / 100})` }}
            />
            {Array.from({ length: sec.slides }, (_, k) => {
              const i = sec.start + k
              const s = agenda[i]
              const now = i === index
              const Tag = onPick ? 'button' : 'span'
              const name = s.title || (s.slide === 'meme' ? 'Meme' : sec.title)
              return (
                <li key={s.id} className="relative flex size-4 items-center justify-center">
                  <Tag
                    {...(onPick ? { type: 'button' as const, onClick: () => onPick(i) } : {})}
                    aria-current={now ? 'step' : undefined}
                    aria-label={`${i + 1}. ${name}`}
                    title={`${sec.title} · ${name}`}
                    className={cn('group flex size-4 items-center justify-center rounded-full', onPick && 'press-sm cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink')}
                  >
                    <span
                      aria-hidden
                      className={cn(
                        'block rounded-full transition-[width,height,background-color,box-shadow] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none',
                        now
                          ? 'size-3 bg-ink shadow-[0_0_0_5px_color-mix(in_oklab,var(--color-ink)_12%,transparent)]'
                          : i < index
                            ? 'size-1.5 bg-ink/70'
                            : 'size-1.5 border border-border-strong bg-parchment',
                        onPick && !now && 'group-hover:bg-ink/40',
                      )}
                    />
                  </Tag>
                </li>
              )
            })}
          </ol>
        )
      })}
    </nav>
  )
}
