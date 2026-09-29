'use client'

import { KINDS, type Kind } from '@/lib/kinds'
import { PROBLEM_MONTH } from '@/lib/experiment'
import { cn } from '@/lib/utils/cn'

/**
 * Pick what you are bringing. A radio group drawn as pills: the selected kind
 * is ink, the rest are hairline outlines. During Problem Month the Problem
 * chip carries a small "this month" mark, so the theme is suggested without
 * closing the other kinds.
 *
 * `onChange` omitted renders it read-only, which is how the landing page's
 * demo composer uses it.
 */
export function KindChips({
  value,
  onChange,
  className,
}: {
  value: Kind
  onChange?: (kind: Kind) => void
  className?: string
}) {
  const interactive = !!onChange
  return (
    <div
      role={interactive ? 'radiogroup' : undefined}
      aria-label={interactive ? 'What are you bringing?' : undefined}
      className={cn('flex flex-wrap gap-1.5', className)}
    >
      {KINDS.map(k => {
        const selected = k.value === value
        const Tag = interactive ? 'button' : 'span'
        return (
          <Tag
            key={k.value}
            {...(interactive
              ? { type: 'button' as const, role: 'radio', 'aria-checked': selected, onClick: () => onChange(k.value) }
              : {})}
            className={cn(
              'inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-[13px] font-medium transition-colors duration-200',
              selected
                ? 'bg-ink border-ink text-parchment'
                : 'border-border-strong text-ink-soft',
              interactive && !selected && 'hover:text-ink hover:border-ink/40',
              interactive && 'press focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron',
            )}
          >
            {k.label}
            {PROBLEM_MONTH && k.value === 'problem' && (
              <span className={cn('font-mono text-[10px] tracking-wide', selected ? 'text-parchment/70' : 'text-saffron')}>
                this month
              </span>
            )}
          </Tag>
        )
      })}
    </div>
  )
}
