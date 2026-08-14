'use client'

import { TopicCard } from '@/components/topics/TopicCard'
import type { Topic } from '@/types'
import type { CyclePhase } from '@/hooks/useCurrentCycle'

interface TopicListProps {
  topics: (Topic & { user_has_voted?: boolean; user_has_contribed?: boolean })[]
  phase: CyclePhase
  cycleId: string
  currentUserId: string | undefined
  votesRemaining: number
  contribsRemaining: number
  onVote: (topicId: string, cycleId: string, hasVoted: boolean) => Promise<void>
  onContrib: (topicId: string, cycleId: string, hasContribed: boolean) => Promise<void>
}

/**
 * Callers branch on `topics.length` before rendering this, so the empty case
 * never reached here. It is the board's `EmptyState` that people actually saw.
 */
export function TopicList(props: TopicListProps) {
  return (
    <div className="space-y-(--gap-list) stagger-children">
      {props.topics.map((topic, i) => (
        <TopicCard key={topic.id} topic={topic} rank={i + 1} {...props} />
      ))}
    </div>
  )
}
