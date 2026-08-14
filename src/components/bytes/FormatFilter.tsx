'use client'

import { useEffect, useRef, useState } from 'react'
import { CaretDown, Check } from '@phosphor-icons/react/dist/ssr'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/utils/cn'

/* Filter by what you have time for, not by where it came from. "Read" folds
   articles and reported pieces together because the decision a member is
   making is fifteen minutes of reading versus ten of watching. */
export type Format = 'all' | 'read' | 'watch'

export const FORMATS: { key: Format; label: string }[] = [
  { key: 'all', label: 'Everything' },
  { key: 'read', label: 'Read' },
  { key: 'watch', label: 'Watch' },
]

/**
 * Format filter, as one small button.
 *
 * It was three pills sitting above the digest, which gave a secondary control
 * the same weight and the same horizontal band as the stories themselves. A
 * filter is furniture: it should be findable and otherwise invisible, so it
 * collapses to a single button that states the current view and opens the rest
 * on demand.
 */
export function FormatFilter({
  value,
  onChange,
}: {
  value: Format
  onChange: (next: Format) => void
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const onPointerDown = (e: MouseEvent | TouchEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }

    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const current = FORMATS.find(f => f.key === value) ?? FORMATS[0]

  return (
    <div ref={wrapRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={cn(
          'press-sm inline-flex items-center gap-1.5 h-8 pl-2.5 pr-2 rounded-(--radius-control) border text-meta transition-colors',
          // Only carries colour when it is actually filtering something out.
          value === 'all'
            ? 'border-border text-ink-soft hover:border-border-strong hover:text-ink'
            : 'border-saffron/40 bg-saffron/12 text-saffron',
        )}
      >
        {current.label}
        <Icon icon={CaretDown} size="sm" />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-(--z-chrome) mt-1.5 min-w-36 rounded-(--radius-card) border border-border bg-paper shadow-lg overflow-hidden"
        >
          {FORMATS.map(f => (
            <button
              key={f.key}
              type="button"
              role="menuitemradio"
              aria-checked={f.key === value}
              onClick={() => {
                onChange(f.key)
                setOpen(false)
              }}
              className={cn(
                'flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-footnote transition-colors',
                f.key === value ? 'text-saffron' : 'text-ink-soft hover:bg-kinu/40 hover:text-ink',
              )}
            >
              {f.label}
              {f.key === value && <Icon icon={Check} size="sm" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
