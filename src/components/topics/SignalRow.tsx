'use client'

import { useEffect, useState } from 'react'
import { Eyes, HandWaving, Question, Wrench } from '@phosphor-icons/react/dist/ssr'
import type { Icon as PhosphorIcon } from '@phosphor-icons/react'
import { SIGNAL_KINDS, SIGNAL_LABELS, SIGNAL_TONES, type SignalKind } from '@/lib/constants'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/utils/cn'

/**
 * Duotone, so each glyph carries two tones of its own hue rather than needing a
 * hand-drawn second layer. This is the reason the icon set moved to Phosphor:
 * emoji could not inherit colour, could not take a weight, and rendered as a
 * different picture on every operating system.
 */
const SIGNAL_ICONS: Record<SignalKind, PhosphorIcon> = {
  curious: Eyes,
  would_attend: HandWaving,
  explain_more: Question,
  done_this: Wrench,
}

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
 * One-tap responses to a topic. No writing, no quota, no cycle gate - this
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

    // Optimistic - a one-tap affordance must feel instant.
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
    <div className={cn('flex items-center gap-1.5 flex-wrap', compact && 'gap-0.5 -ml-1')}>
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
            aria-label={SIGNAL_LABELS[signal]}
            title={SIGNAL_LABELS[signal]}
            className={cn(
              /* Two sizes, because the two placements are different jobs.
                 On the detail page the label renders: you are reading one
                 topic and four named responses are a menu. On a board card the
                 label is dropped and the glyph carries it, because four
                 labelled pills under every title is a second row of controls
                 fighting the content - the title of the browser tooltip and
                 the aria-label keep the meaning reachable.
                 No box at rest either way. The box appears on hover, or stays
                 once you have tapped. */
              'press inline-flex items-center gap-1.5 transition-colors disabled:opacity-60',
              compact
                /* On a card: a glyph the size of the comment count beside it,
                   with a real thumb target underneath on touch. */
                ? 'h-7 w-7 justify-center rounded-md type-caption pointer-coarse:h-10 pointer-coarse:w-10'
                /* On the detail page: a labelled chip on the same 13px step and
                   the same shape as the Upvote and Join buttons below it. The
                   row used to be bare text at a size that matched nothing else
                   on the screen. */
                : 'h-8 px-2.5 rounded-(--radius-control) border text-footnote pointer-coarse:h-10 pointer-coarse:px-3',
              compact && count > 0 && 'w-auto px-1.5 pointer-coarse:w-auto pointer-coarse:px-2.5',
              active
                ? 'bg-saffron/12 text-saffron' + (compact ? '' : ' border-saffron/45')
                : compact
                  ? 'text-ink-muted hover:bg-kinu hover:text-ink-soft'
                  : 'border-border text-ink-soft hover:border-border-strong hover:text-ink',
            )}
          >
            {/* The hue is a redundant cue on top of the glyph and the label,
                never the only one carrying the meaning. It drops out when the
                signal is active, so the saffron "you tapped this" state stays
                unambiguous. */}
            <Icon
              icon={SIGNAL_ICONS[signal]}
              size="sm"
              weight="duotone"
              className={active ? undefined : SIGNAL_TONES[signal]}
            />
            {!compact && <span>{SIGNAL_LABELS[signal]}</span>}
            {count > 0 && <span className="tabular-nums opacity-80">{count}</span>}
          </button>
        )
      })}
    </div>
  )
}
