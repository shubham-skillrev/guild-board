'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { OUTCOME_LABELS } from '@/lib/constants'
import { Badge } from '@/components/ui/Badge'
import type { OutcomeTag } from '@/types'

interface Outcome {
  id: string
  title: string
  outcome_tag: OutcomeTag
  outcome_note: string | null
  author_username: string | null
}

const TONE: Partial<Record<OutcomeTag, 'matcha' | 'wisteria' | 'saffron' | 'neutral'>> = {
  blog_born: 'wisteria',
  project_started: 'matcha',
  discussed: 'neutral',
  carry_forward: 'saffron',
}

const ICON: Partial<Record<OutcomeTag, string>> = {
  blog_born: '✍️',
  project_started: '🚀',
  discussed: '💬',
  carry_forward: '↪️',
}

/**
 * "Last cycle we said we'd…" - closes the accountability loop.
 * Nothing kills an idea board faster than ideas going in and nothing
 * visibly coming out, and every unfinished item here is a natural next topic.
 */
export function OutcomesRecap() {
  const [cycle, setCycle] = useState<{ label: string } | null>(null)
  const [outcomes, setOutcomes] = useState<Outcome[]>([])
  const [collapsed, setCollapsed] = useState(false)

  useEffect(() => {
    fetch('/api/outcomes')
      .then(r => r.json())
      .then(data => {
        setCycle(data.cycle ?? null)
        setOutcomes(Array.isArray(data.outcomes) ? data.outcomes : [])
      })
      .catch(() => {})
  }, [])

  if (!cycle || outcomes.length === 0) return null

  return (
    <section className="mb-6 rounded-(--radius-card) border border-border bg-paper/50 overflow-hidden">
      <button
        type="button"
        onClick={() => setCollapsed(c => !c)}
        className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-kinu/30 transition-colors"
      >
        <span className="text-[13px] font-semibold text-ink">
          What came out of {cycle.label}
        </span>
        <span className="text-[11px] text-cha tabular-nums">{outcomes.length}</span>
        <svg
          className={`w-3.5 h-3.5 text-cha ml-auto shrink-0 transition-transform ${collapsed ? '' : 'rotate-180'}`}
          fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {!collapsed && (
        <ul className="px-4 pb-3.5 space-y-2.5">
          {outcomes.map(o => (
            <li key={o.id} className="flex items-start gap-2.5">
              <span className="text-[13px] mt-0.5 shrink-0">{ICON[o.outcome_tag] ?? '•'}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={`/board/${o.id}`}
                    className="text-[13px] text-ink hover:text-saffron transition-colors"
                  >
                    {o.title}
                  </Link>
                  <Badge tone={TONE[o.outcome_tag] ?? 'neutral'}>
                    {OUTCOME_LABELS[o.outcome_tag]}
                  </Badge>
                </div>
                {o.outcome_note && (
                  <p className="text-[12px] text-ink-soft mt-0.5 leading-relaxed">{o.outcome_note}</p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
