'use client'

/**
 * What you have left to spend this cycle.
 *
 * One grouped strip rather than three large tiles. These are metadata about
 * your standing, not the reason the page exists, and sizing them like hero
 * statistics pushed the topic list, the actual content, below the fold.
 *
 * Colour marks the exception only. Every chip tinted saffron is the same as no
 * chip tinted saffron: the eye gets no ranking out of it. So a quota is plain
 * until it runs out, and then it is the only warm thing in the row.
 */

import { ArrowBigUp, Handshake, CircleCheck } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { Icon } from '@/components/ui/Icon'

function Quota({
  icon,
  children,
  state,
}: {
  icon: LucideIcon
  children: React.ReactNode
  /** `spent` is the exception worth colouring. `done` is a completed good thing. */
  state: 'available' | 'spent' | 'done'
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-(--radius-control) text-footnote ${
        state === 'spent'
          ? 'bg-saffron-light text-saffron'
          : state === 'done'
            ? 'bg-kinu/50 text-ink-muted'
            : 'bg-kinu/50 text-ink-soft'
      }`}
    >
      <Icon
        icon={icon}
        size="sm"
        className={state === 'available' ? 'text-ink-muted' : undefined}
      />
      {children}
    </span>
  )
}

export function QuotaStrip({
  votesRemaining,
  contribsRemaining,
  topicSubmitted,
}: {
  votesRemaining: number
  contribsRemaining: number
  topicSubmitted: boolean
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 bg-paper/60 border border-border rounded-(--radius-card)">
      <Quota icon={ArrowBigUp} state={votesRemaining > 0 ? 'available' : 'spent'}>
        <span className="tabular">{votesRemaining}</span>{' '}
        {votesRemaining === 1 ? 'vote' : 'votes'} left
      </Quota>

      <Quota icon={Handshake} state={contribsRemaining > 0 ? 'available' : 'spent'}>
        <span className="tabular">{contribsRemaining}</span>{' '}
        {contribsRemaining === 1 ? 'hand raise' : 'hand raises'} left
      </Quota>

      {/* Only stated once it is true. "0 ideas pitched" as a standing headline
          reports a failure at a moment when nothing has gone wrong yet. */}
      {topicSubmitted && (
        <Quota icon={CircleCheck} state="done">
          Idea pitched
        </Quota>
      )}
    </div>
  )
}
