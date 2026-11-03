'use client'

import { Check } from '@phosphor-icons/react/dist/ssr'
import { cn } from '@/lib/utils/cn'
import { DEMO_FORMATS, type DemoFormat } from '@/lib/showtell'

/** Pick a Show & Tell format: native radios dressed as pills. */
export function FormatPills({
  name,
  value,
  onChange,
  only,
}: {
  name: string
  value: DemoFormat | null
  onChange: (f: DemoFormat) => void
  /** Limit the choice (e.g. the smaller formats once passes are used). */
  only?: DemoFormat[]
}) {
  const options = only ? DEMO_FORMATS.filter(f => only.includes(f.value)) : DEMO_FORMATS
  return (
    <div role="radiogroup" aria-label="Format" className="flex flex-wrap gap-1.5">
      {options.map(f => (
        <label
          key={f.value}
          title={f.hint}
          className={cn(
            'group press-sm inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-footnote cursor-pointer select-none transition-colors',
            'pointer-coarse:h-10 pointer-coarse:px-4',
            'has-checked:bg-ink has-checked:border-ink has-checked:text-parchment',
            'not-has-checked:border-border not-has-checked:bg-paper not-has-checked:text-ink-soft not-has-checked:hover:text-ink',
            'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink',
          )}
        >
          <input type="radio" name={name} className="sr-only" checked={value === f.value} onChange={() => onChange(f.value)} />
          <Check weight="bold" className="hidden size-3 group-has-checked:block" aria-hidden />
          {f.label}
        </label>
      ))}
    </div>
  )
}
