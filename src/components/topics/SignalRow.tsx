'use client'

import { useEffect, useState } from 'react'
import { SIGNAL_KINDS, SIGNAL_LABELS, SIGNAL_EMOJI, type SignalKind } from '@/lib/constants'
import { cn } from '@/lib/utils/cn'

interface SignalRowProps {
  topicId: string
  /** Compact styling for the board list; full labels on the detail page. */
  compact?: boolean
  /**
   * Counts already fetched by the parent. The board ships these inline with
   * /api/topics so a list of cards does not fire one request each; omit them
   * and the row fetches its own.
   */
  initialCounts?: Record<string, number>
  initialMine?: string[]
}

/**
 * One-tap responses to a topic. No writing, no quota, no cycle gate — this
 * stays usable when voting and commenting are locked, which is most of the
 * month. There is no negative signal by design.
 */
export function SignalRow({ topicId, compact = false, initialCounts, initialMine }: SignalRowProps) {
  const hasInitial = initialCounts !== undefined
  const [counts, setCounts] = useState<Record<string, number>>(initialCounts ?? {})
  const [mine, setMine] = useState<Set<SignalKind>>(new Set((initialMine ?? []) as SignalKind[]))
  const [pending, setPending] = useState<SignalKind | null>(null)
  const [loaded, setLoaded] = useState(hasInitial)

  useEffect(() => {
    if (hasInitial) return
    let cancelled = false
    fetch(`/api/topic-signals?topic_id=${topicId}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        setCounts(data.counts ?? {})
        setMine(new Set(data.mine ?? []))
        setLoaded(true)
      })
      .catch(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
  }, [topicId, hasInitial])

  const toggle = async (signal: SignalKind) => {
    if (pending) return
    setPending(signal)

    // Optimistic — a one-tap affordance must feel instant.
    const wasActive = mine.has(signal)
    setMine(prev => {
      const next = new Set(prev)
      if (wasActive) next.delete(signal); else next.add(signal)
      return next
    })
    setCounts(prev => ({ ...prev, [signal]: Math.max((prev[signal] ?? 0) + (wasActive ? -1 : 1), 0) }))

    try {
      const res = await fetch('/api/topic-signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_id: topicId, signal }),
      })
      if (!res.ok) throw new Error('failed')
    } catch {
      // Roll back.
      setMine(prev => {
        const next = new Set(prev)
        if (wasActive) next.add(signal); else next.delete(signal)
        return next
      })
      setCounts(prev => ({ ...prev, [signal]: Math.max((prev[signal] ?? 0) + (wasActive ? 1 : -1), 0) }))
    } finally {
      setPending(null)
    }
  }

  if (!loaded) return null

  return (
    <div className={cn('flex items-center gap-1.5 flex-wrap', compact && 'gap-1')}>
      {SIGNAL_KINDS.map(signal => {
        const active = mine.has(signal)
        const count = counts[signal] ?? 0
        return (
          <button
            key={signal}
            type="button"
            onClick={e => { e.preventDefault(); e.stopPropagation(); toggle(signal) }}
            disabled={pending !== null}
            aria-pressed={active}
            title={SIGNAL_LABELS[signal]}
            className={cn(
              'inline-flex items-center gap-1 rounded-full border transition-all disabled:opacity-60',
              compact ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-[12px]',
              active
                ? 'border-saffron/40 bg-saffron-light text-saffron'
                : 'border-border text-ink-soft hover:border-border-strong hover:bg-kinu/40',
            )}
          >
            <span>{SIGNAL_EMOJI[signal]}</span>
            {!compact && <span>{SIGNAL_LABELS[signal]}</span>}
            {count > 0 && <span className="tabular-nums opacity-80">{count}</span>}
          </button>
        )
      })}
    </div>
  )
}
