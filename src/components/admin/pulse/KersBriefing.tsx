'use client'

import { useState } from 'react'
import { ArrowClockwise } from '@phosphor-icons/react/dist/ssr'
import { Kers } from '@/components/kers/Kers'
import { Icon } from '@/components/ui/Icon'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/utils/cn'

export interface BriefingView {
  body: string
  byAi: boolean
  refreshesLeft: number
}

/**
 * Kers at his desk, reading the numbers out. The bubble is his; the numbers
 * in it were worked out by code before he ever saw them.
 */
export function KersBriefing({ scope, initial, className }: { scope: string; initial: BriefingView; className?: string }) {
  const toast = useToast()
  const [b, setB] = useState(initial)
  const [busy, setBusy] = useState(false)

  const again = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/admin/kers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Kers is not answering')
      setB(data)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Kers is not answering', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-label="Kers' briefing" className={cn('flex items-end gap-3 sm:gap-5', className)}>
      <Kers size={104} follow state={busy ? 'thinking' : null} expression="smug" className="shrink-0 max-sm:hidden" />
      <Kers size={64} follow state={busy ? 'thinking' : null} expression="smug" className="shrink-0 sm:hidden" />
      <div className="relative min-w-0 flex-1">
        {/* The bubble's tail points at Kers. */}
        <span aria-hidden className="absolute -left-1.5 bottom-6 size-3 rotate-45 border-b border-l border-border bg-paper" />
        <div className="rounded-[20px] border border-border bg-paper px-5 py-4 shadow-[0_10px_30px_var(--shadow-tint)]">
          <p className={cn('text-[17px] leading-relaxed text-ink transition-opacity', busy && 'opacity-50')}>{b.body}</p>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-meta text-ink-muted">
            <span>{b.byAi ? 'Kers, from today’s numbers' : 'Kers’ quick read'}</span>
            {b.refreshesLeft > 0 && (
              <button type="button" onClick={again} disabled={busy} className="press-sm inline-flex items-center gap-1 hover:text-ink disabled:opacity-50">
                <Icon icon={ArrowClockwise} size="sm" className={cn(busy && 'animate-spin')} />
                {busy ? 'Thinking…' : `Ask again (${b.refreshesLeft} left today)`}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}
