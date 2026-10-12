'use client'

import { useRef } from 'react'
import { cn } from '@/lib/utils/cn'

/**
 * A few mutually exclusive options, side by side. For a filter with two to four
 * short choices: everything is visible, one tap switches, nothing to open.
 *
 * Same 32px height and 13px text as Button and the header chips, so it sits in
 * a row with them. The selected option is a raised pill on a quiet track; it is
 * a radio group to assistive tech, with arrow keys moving the selection.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
}: {
  options: { key: T; label: string }[]
  value: T
  onChange: (next: T) => void
  /** Accessible name for the group, e.g. "Format". */
  label: string
  className?: string
}) {
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  const move = (from: number, step: number) => {
    const next = (from + step + options.length) % options.length
    onChange(options[next].key)
    refs.current[next]?.focus()
  }

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('inline-flex items-center h-8 p-0.5 rounded-full bg-fill border border-border', className)}
    >
      {options.map((o, i) => {
        const selected = o.key === value
        return (
          <button
            key={o.key}
            ref={el => { refs.current[i] = el }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(o.key)}
            onKeyDown={e => {
              if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); move(i, 1) }
              if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); move(i, -1) }
            }}
            className={cn(
              'press-sm h-full px-3 rounded-full text-footnote whitespace-nowrap transition-colors',
              'pointer-coarse:px-4',
              selected ? 'bg-paper text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
