'use client'

import { TopicCard } from '@/components/topics/TopicCard'
import type { Topic } from '@/types'
import type { CyclePhase } from '@/hooks/useCurrentCycle'

interface TopicListProps {
  topics: (Topic & { user_has_voted?: boolean })[]
  phase: CyclePhase
  cycleId: string
  currentUserId: string | undefined
  votesRemaining: number
  onVote: (topicId: string, cycleId: string, hasVoted: boolean) => Promise<void>
}

/**
 * Callers branch on `topics.length` before rendering this, so the empty case
 * never reached here. It is the board's `EmptyState` that people actually saw.
 */
export function TopicList(props: TopicListProps) {
  return (
    /* A grid of cards, two across from md up, in rank order reading left to
       right. Rows stretch to their tallest card and each card pins its footer
       to the bottom, so the counts line up across a row. */
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 stagger-children">
      {props.topics.map((topic, i) => (
        <TopicCard key={topic.id} topic={topic} rank={i + 1} {...props} />
      ))}
    </div>
  )
}
