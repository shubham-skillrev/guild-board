'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils/cn'
import { BiUpvote, BiSolidUpvote } from 'react-icons/bi'

interface VoteButtonProps {
  topicId: string
  cycleId: string
  count: number
  hasVoted: boolean
  disabled: boolean
  onVote: (topicId: string, cycleId: string, hasVoted: boolean) => Promise<void>
}

export function VoteButton({ topicId, cycleId, count, hasVoted, disabled, onVote }: VoteButtonProps) {
  const [isPending, setIsPending] = useState(false)

  const handleClick = async () => {
    if (isPending || disabled) return
    setIsPending(true)
    try {
      await onVote(topicId, cycleId, hasVoted)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending || disabled}
      aria-label={hasVoted ? 'Remove vote' : 'Upvote'}
      className={cn(
        'flex flex-col items-center justify-center gap-0.5 w-14 h-[72px] rounded-xl border text-center transition-all',
        hasVoted
          ? 'bg-saffron/10 border-saffron/30 text-saffron hover:bg-saffron/15'
          : 'bg-paper border-border text-ink-soft hover:border-border-strong hover:text-ink hover:bg-kinu/30',
        isPending
          ? 'opacity-60 cursor-wait'
          : disabled
            ? 'opacity-40 cursor-not-allowed'
            : 'cursor-pointer'
      )}
    >
      {isPending ? (
        <span className="w-5 h-5 rounded-full border-2 border-current border-t-transparent animate-spin-fast" />
      ) : (
        <span className={cn('transition-transform', hasVoted && 'animate-vote-pop')}>
          {hasVoted
            ? <BiSolidUpvote className="w-5 h-5" />
            : <BiUpvote className="w-5 h-5" />
          }
        </span>
      )}
      <span className="text-sm font-bold tabular-nums leading-none">{count}</span>
    </button>
  )
}
