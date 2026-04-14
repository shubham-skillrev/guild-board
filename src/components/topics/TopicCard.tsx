'use client'

import { useState } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils/cn'
import { CATEGORY_LABELS } from '@/lib/constants'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { BiUpvote, BiSolidUpvote } from 'react-icons/bi'
import { FaHandshake } from 'react-icons/fa6'
import { IoChatbubbleOutline } from 'react-icons/io5'
import type { Topic } from '@/types'
import type { CyclePhase } from '@/hooks/useCurrentCycle'

const CATEGORY_STYLES: Record<string, { dot: string; badge: string }> = {
  deep_dive: {
    dot: 'bg-indigo-jp',
    badge: 'text-indigo-jp bg-indigo-light',
  },
  discussion: {
    dot: 'bg-saffron',
    badge: 'text-saffron bg-saffron-light',
  },
  blog_idea: {
    dot: 'bg-matcha',
    badge: 'text-matcha bg-matcha-light',
  },
  project_showcase: {
    dot: 'bg-wisteria',
    badge: 'text-wisteria bg-wisteria-light',
  },
}

interface TopicCardProps {
  topic: Topic & { user_has_voted?: boolean; user_has_contribed?: boolean }
  rank: number
  phase: CyclePhase
  cycleId: string
  currentUserId: string | undefined
  votesRemaining: number
  contribsRemaining: number
  onVote: (topicId: string, cycleId: string, hasVoted: boolean) => Promise<void>
  onContrib: (topicId: string, cycleId: string, hasContribed: boolean) => Promise<void>
}

export function TopicCard({
  topic,
  rank,
  phase,
  cycleId,
  currentUserId,
  votesRemaining,
  contribsRemaining,
  onVote,
  onContrib,
}: TopicCardProps) {
  const [votePending, setVotePending] = useState(false)
  const [contribPending, setContribPending] = useState(false)

  const isOwner = currentUserId === topic.user_id
  const canVote = phase === 'open' && !isOwner
  const canContrib = phase === 'open' && !isOwner
  const style = CATEGORY_STYLES[topic.category] ?? CATEGORY_STYLES.discussion
  const commentCount = (topic as Topic & { comment_count?: number }).comment_count ?? 0
  const titlePreview = topic.title.length > 52 ? `${topic.title.slice(0, 52)}...` : topic.title
  const descriptionPreview = topic.description.length > 50 ? `${topic.description.slice(0, 50)}...` : topic.description

  const hasVoted = !!topic.user_has_voted
  const hasContributed = !!topic.user_has_contribed
  const voteDisabled = votePending || (!hasVoted && votesRemaining === 0)
  const contribDisabled = contribPending || (!hasContributed && contribsRemaining === 0)

  const handleVote = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!canVote || voteDisabled) return
    setVotePending(true)
    try { await onVote(topic.id, cycleId, hasVoted) } finally { setVotePending(false) }
  }

  const handleContrib = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!canContrib || contribDisabled) return
    setContribPending(true)
    try { await onContrib(topic.id, cycleId, hasContributed) } finally { setContribPending(false) }
  }

  const cardClassName = cn(
    'group flex gap-3 sm:gap-4 bg-paper/50 border border-border rounded-xl p-3.5 sm:p-4 transition-all',
    'hover:border-border-strong hover:bg-paper/80',
    topic.is_selected && 'ring-1 ring-saffron/30 border-saffron/20',
    (votePending || contribPending) && 'opacity-75',
  )

  const cardContent = (
    <>
      {/* Rank */}
      <div className="hidden sm:flex flex-col items-center pt-0.5 shrink-0 w-8">
        <span className={cn(
          'text-sm font-semibold tabular-nums',
          rank <= 3 ? 'text-saffron' : 'text-cha',
        )}>
          {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : `#${rank}`}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1.5">
        {/* Badges */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={cn('inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full', style.badge)}>
            <span className={cn('w-1.5 h-1.5 rounded-full', style.dot)} />
            {CATEGORY_LABELS[topic.category]}
          </span>
          {topic.status === 'carry_forward' && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-light text-indigo-jp">↩ Returning</span>
          )}
          {topic.is_selected && (
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-saffron-light text-saffron">★ Selected</span>
          )}
        </div>

        {/* Title */}
        <h3 className="font-semibold text-ink text-[14px] sm:text-[15px] leading-snug group-hover:text-saffron transition-colors truncate">
          {titlePreview}
        </h3>

        {/* Description preview */}
        <p className="text-ink-soft text-[12px] sm:text-[13px] leading-relaxed truncate">
          {descriptionPreview}
        </p>

        {/* Bottom: author + comments */}
        <div className="flex items-center gap-3 pt-1">
          <div className="flex items-center gap-1.5">
            <UserAvatar username={topic.author_username ?? 'user'} size={18} />
            <span className="text-[12px] text-ink-soft">@{topic.author_username}</span>
          </div>
          <span className="inline-flex items-center gap-1 text-[12px] text-cha">
            <IoChatbubbleOutline className="w-3.5 h-3.5" />
            {commentCount > 0 ? commentCount : 'Discuss'}
          </span>
        </div>
      </div>

      <div className="flex flex-col items-center gap-1.5 shrink-0 pt-0.5 justify-end">
        <button
          onClick={handleVote}
          disabled={!canVote || voteDisabled}
          aria-label={hasVoted ? 'Remove vote' : 'Upvote'}
          className={cn(
            'flex flex-col items-center justify-center gap-0.5 w-12 sm:w-14 h-16 sm:h-18 rounded-xl border text-center transition-all',
            canVote && !voteDisabled && 'cursor-pointer',
            hasVoted
              ? 'bg-saffron/20 border-saffron/60 text-saffron shadow-[0_0_12px_rgba(232,145,58,0.2)]'
              : canVote && !voteDisabled
                ? 'bg-kinu/40 border-border-strong text-ink hover:border-saffron/45 hover:text-saffron hover:bg-saffron/10'
                : 'bg-kinu/30 border-border-strong text-ink-soft',
            votePending && 'opacity-70 cursor-default',
          )}
        >
          {hasVoted ? (
            <BiSolidUpvote className={cn('w-5 h-5 transition-transform', hasVoted && 'scale-110')} />
          ) : (
            <BiUpvote className="w-5 h-5" />
          )}
          <span className="text-[15px] font-bold tabular-nums leading-none">{topic.vote_count}</span>
        </button>

        <button
          onClick={handleContrib}
          disabled={!canContrib || contribDisabled}
          aria-label={hasContributed ? 'Withdraw' : "I'll contribute"}
          className={cn(
            'flex items-center justify-center gap-1 w-12 sm:w-14 h-9 rounded-lg border text-[12px] font-medium transition-all',
            canContrib && !contribDisabled && 'cursor-pointer',
            hasContributed
              ? 'bg-matcha/20 border-matcha/60 text-matcha shadow-[0_0_10px_rgba(61,184,138,0.18)]'
              : canContrib && !contribDisabled
                ? 'bg-kinu/40 border-border-strong text-ink hover:border-matcha/45 hover:text-matcha hover:bg-matcha/10'
                : 'bg-kinu/30 border-border-strong text-ink-soft',
            contribPending && 'opacity-70 cursor-default',
          )}
        >
          <FaHandshake className={cn('w-3.5 h-3.5', hasContributed && 'scale-110')} />
          <span className="tabular-nums font-semibold">{topic.contrib_count}</span>
        </button>
      </div>
    </>
  )

  return (
    <Link href={`/board/${topic.id}`} className={cardClassName}>
      {cardContent}
    </Link>
  )
}
