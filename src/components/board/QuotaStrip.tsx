'use client'

/**
 * What you have left to spend this cycle.
 *
 * One grouped strip rather than three large tiles. These are metadata about
 * your standing, not the reason the page exists, and sizing them like hero
 * statistics pushed the topic list, the actual content, below the fold.
 *
 * The strip itself is `StatStrip`, shared with the leaderboard's cohort stats,
 * because the two are the same object and had drifted into two hand-rolled
 * versions of it.
 *
 * Colour marks the exception only. Every chip tinted saffron is the same as no
 * chip tinted saffron: the eye gets no ranking out of it. So a quota is plain
 * until it runs out, and then it is the only warm thing in the row.
 */

import { ArrowFatUp, Handshake, CheckCircle } from '@phosphor-icons/react/dist/ssr'
import { StatStrip, StatChip } from '@/components/ui/Section'

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
    <StatStrip>
      <StatChip
        icon={ArrowFatUp}
        value={votesRemaining}
        label={`${votesRemaining === 1 ? 'vote' : 'votes'} left`}
        tone={votesRemaining > 0 ? 'default' : 'spent'}
      />

      <StatChip
        icon={Handshake}
        value={contribsRemaining}
        label={`${contribsRemaining === 1 ? 'hand raise' : 'hand raises'} left`}
        tone={contribsRemaining > 0 ? 'default' : 'spent'}
      />

      {/* Only stated once it is true. "0 ideas pitched" as a standing headline
          reports a failure at a moment when nothing has gone wrong yet. */}
      {topicSubmitted && <StatChip icon={CheckCircle} label="Idea pitched" tone="done" />}
    </StatStrip>
  )
}
