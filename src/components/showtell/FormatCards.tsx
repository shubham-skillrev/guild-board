'use client'

import { Check } from '@phosphor-icons/react/dist/ssr'
import { cn } from '@/lib/utils/cn'
import { DEMO_FORMATS, type DemoFormat } from '@/lib/showtell'

/**
 * The formats as small cards, each saying what it means, so "Lightning" and
 * "Pair up" explain themselves. Native radios underneath: arrow keys move
 * the choice, and screen readers hear a radio group.
 */
export function FormatCards({ name, value, onChange }: { name: string; value: DemoFormat; onChange: (f: DemoFormat) => void }) {
  return (
    <div role="radiogroup" aria-label="Format" className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {DEMO_FORMATS.map(f => (
        <label
          key={f.value}
          className={cn(
            'group relative cursor-pointer select-none rounded-(--radius-control) border px-3 py-2.5 transition-colors',
            'has-checked:border-ink has-checked:bg-kinu/60',
            'not-has-checked:border-border-strong not-has-checked:hover:border-ink/40',
            'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink',
          )}
        >
          <input type="radio" name={name} className="sr-only" checked={value === f.value} onChange={() => onChange(f.value)} />
          <span className="flex items-center justify-between gap-2">
            <span className="text-footnote font-medium text-ink">{f.label}</span>
            <span className="grid size-4 place-items-center rounded-full border border-border-strong group-has-checked:border-ink group-has-checked:bg-ink">
              <Check weight="bold" className="hidden size-2.5 text-parchment group-has-checked:block" aria-hidden />
            </span>
          </span>
          <span className="mt-0.5 block text-meta leading-snug text-ink-muted">{f.hint}</span>
        </label>
      ))}
    </div>
  )
}
