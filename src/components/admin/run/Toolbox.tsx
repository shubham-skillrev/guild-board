'use client'

import { useState } from 'react'
import { CaretDown } from '@phosphor-icons/react/dist/ssr'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/utils/cn'

/**
 * The rarer jobs, folded away: one row each, opened in place. Keeps the Run
 * tab about this month's meeting while everything else stays one click off.
 */
export function Toolbox({ sections }: { sections: { id: string; title: string; hint: string; body: React.ReactNode }[] }) {
  const [open, setOpen] = useState<string | null>(null)
  return (
    <section aria-labelledby="run-toolbox">
      <h2 id="run-toolbox" className="mb-3 text-title-3 text-label">Toolbox</h2>
      <ul className="elev-1 rounded-(--radius-card) divide-y divide-separator overflow-hidden">
        {sections.map(s => {
          const isOpen = open === s.id
          return (
            <li key={s.id}>
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={`tool-${s.id}`}
                onClick={() => setOpen(isOpen ? null : s.id)}
                className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-kinu/30 transition-colors"
              >
                <span className="min-w-0 flex-1">
                  <span className="block text-footnote font-medium text-ink">{s.title}</span>
                  <span className="block text-meta text-ink-muted">{s.hint}</span>
                </span>
                <Icon icon={CaretDown} size="sm" className={cn('text-ink-muted transition-transform', isOpen && 'rotate-180')} />
              </button>
              {/* Kept mounted, so a half-filled form survives closing the row. */}
              <div id={`tool-${s.id}`} hidden={!isOpen} className="border-t border-separator px-5 py-5 [&>section]:mt-0 [&>div>section]:mt-0">
                {s.body}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
