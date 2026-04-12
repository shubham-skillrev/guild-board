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

export function TopicList(props: TopicListProps) {
  if (props.topics.length === 0) {
    return (
      <div className="text-center py-20">
        <div className="text-2xl mb-3">📜</div>
        <p className="text-base font-medium text-ink-soft">No ideas yet</p>
        <p className="text-[13px] mt-1 text-cha">Be the first to pitch something for this cycle.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3 stagger-children">
      {props.topics.map((topic, i) => (
        <TopicCard key={topic.id} topic={topic} rank={i + 1} {...props} />
      ))}
    </div>
  )
}
