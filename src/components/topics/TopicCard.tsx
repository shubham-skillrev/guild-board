'use client'

import { ArrowFatUp, ChartBar } from '@phosphor-icons/react/dist/ssr'
import { useState } from 'react'
import Link from 'next/link'
import { SignalRow } from '@/components/topics/SignalRow'
import { cn } from '@/lib/utils/cn'
import { CATEGORY_LABELS, CATEGORY_TONE } from '@/lib/constants'
import { kindOf, reactionFor } from '@/lib/kinds'
import { AuthorMark } from '@/components/topics/AuthorMark'
import { Badge } from '@/components/ui/Badge'
import { FOCUS_FORMAT, problemBlurb } from '@/lib/experiment'
import { timeAgo } from '@/lib/utils/time'
import type { Topic } from '@/types'

import type { CyclePhase } from '@/hooks/useCurrentCycle'

// Stable empties: SignalRow treats a new liveCounts object as a fresh tally.
const NO_COUNTS: Record<string, number> = {}
const NO_SIGNALS: string[] = []

interface TopicCardProps {
  topic: Topic & { user_has_voted?: boolean }
  rank: number
  phase: CyclePhase
  cycleId: string
  currentUserId: string | undefined
  votesRemaining: number
  onVote: (topicId: string, cycleId: string, hasVoted: boolean) => Promise<void>
}

export function TopicCard({
  topic,
  rank,
  phase,
  cycleId,
  currentUserId,
  votesRemaining,
  onVote,
}: TopicCardProps) {
  const [votePending, setVotePending] = useState(false)

  // Server-computed: topic.user_id is absent on ghost topics, so ownership
  // cannot be derived client-side. Falls back to the id compare for any
  // payload that predates the anonymity serializer.
  const isOwner = topic.is_owner ?? currentUserId === topic.user_id
  const canVote = phase === 'open' && !isOwner
  const categoryTone = CATEGORY_TONE[topic.category] ?? 'saffron'
  const commentCount = (topic as Topic & { comment_count?: number }).comment_count ?? 0
  const signalCounts = topic.signal_counts ?? NO_COUNTS
  const mySignals = topic.my_signals ?? NO_SIGNALS
  /* Truncation is CSS's job, not a character count's. A fixed 52-char slice cut
     mid-word well short of the card's actual width and then CSS clipped what
     was left, so a title lost two words it had room for. `truncate` ellipsizes
     at the real edge, whatever the viewport is. */

  const hasVoted = !!topic.user_has_voted
  const reaction = reactionFor(topic.category)
  const voteDisabled = votePending || (!hasVoted && votesRemaining === 0)

  const handleVote = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!canVote || voteDisabled) return
    setVotePending(true)
    try { await onVote(topic.id, cycleId, hasVoted) } finally { setVotePending(false) }
  }

  /* The wall card from the landing page, made real: kind first, then the
     title, a short blurb, and one quiet footer of counts. Flex column so the
     footer sits on the bottom edge and lines up across a grid row. */
  const cardClassName = cn(
    'group flex flex-col h-full bg-paper border border-border rounded-(--radius-card) p-5 transition-[border-color,box-shadow,transform]',
    'hover:border-border-strong hover:shadow-[0_12px_32px_-16px_var(--shadow-tint-strong)]',
    topic.is_selected && 'border-saffron/40',
    votePending && 'opacity-75',
  )

  const pill = 'press inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-[13px] font-medium transition-colors pointer-coarse:h-10 disabled:cursor-not-allowed'

  const cardContent = (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Kinds always show: a mixed board is scanned by kind. The old
              categories only outside Problem Month. */}
          {(!FOCUS_FORMAT || kindOf(topic.category)) && (
            <Badge tone={categoryTone} dot>{CATEGORY_LABELS[topic.category]}</Badge>
          )}
          {topic.is_selected && <Badge tone="saffron">On the agenda</Badge>}
          {topic.status === 'carry_forward' && <Badge tone="indigo">Returning</Badge>}
          {/* Votes happen on the topic page, where there is room for the bars. */}
          {topic.poll && (
            <span className="inline-flex items-center gap-1 text-[12px] text-cha" title={topic.poll.question}>
              <ChartBar className="w-3.5 h-3.5" />
              Poll · <span className="tabular-nums">{topic.poll.total_votes}</span>
            </span>
          )}
        </div>
        {!FOCUS_FORMAT && (
          <span className={cn('font-mono text-[12px] tabular-nums pt-0.5', rank <= 3 ? 'text-saffron' : 'text-cha')}>
            #{rank}
          </span>
        )}
      </div>

      <h3 className="mt-3.5 text-[16px] font-semibold leading-snug tracking-[-0.015em] text-ink line-clamp-3">
        {topic.title}
      </h3>
      <p className="mt-1.5 text-[13px] leading-relaxed text-cha line-clamp-2">
        {problemBlurb(topic.description)}
      </p>

      <div className="mt-2.5 flex items-center gap-1.5 text-[12px] text-cha">
        <AuthorMark username={topic.author_username} isSystem={topic.is_system} />
        <span aria-hidden>·</span>
        <time dateTime={topic.created_at} className="shrink-0">{timeAgo(topic.created_at)}</time>
      </div>

      {/* mt-auto: whatever the text height, the counts sit on the bottom edge. */}
      {/* One row, never wrapping: the counts on the left, replies pinned right. */}
      <div className="mt-auto pt-4 flex items-center gap-1.5">
        {/* You cannot back your own post, so on it the counts show as plain
            text rather than as disabled buttons: a greyed control reads as
            broken, but you still want to see who is with you. */}
        {isOwner ? (
          <span className="inline-flex items-center gap-1.5 h-8 px-1.5 text-[13px] text-ink-soft" title="Upvotes">
            <ArrowFatUp className="w-3.5 h-3.5" />
            <span className="tabular-nums font-semibold">{topic.vote_count}</span>
          </span>
        ) : (
          <button
            onClick={handleVote}
            disabled={!canVote || voteDisabled}
            aria-pressed={hasVoted}
            aria-label={
              FOCUS_FORMAT
                ? hasVoted ? `${reaction.done} (unmark)` : reaction.idle
                : hasVoted ? 'Remove vote' : 'Upvote'
            }
            title={FOCUS_FORMAT ? (hasVoted ? reaction.done : reaction.idle) : undefined}
            className={cn(
              pill,
              hasVoted
                ? 'bg-saffron-light border-saffron/40 text-saffron'
                : canVote && !voteDisabled
                  ? 'border-border text-ink-soft hover:border-saffron/40 hover:text-saffron'
                  : 'border-border text-ink-muted',
              votePending && 'opacity-60 cursor-wait',
            )}
          >
            {votePending
              ? <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin-fast" />
              : <ArrowFatUp className="w-3.5 h-3.5" weight={hasVoted ? 'fill' : 'regular'} />}
            <span className="tabular-nums font-semibold">{topic.vote_count}</span>
          </button>
        )}

        <SignalRow topicId={topic.id} compact initialCounts={signalCounts} initialMine={mySignals} liveCounts={signalCounts} />

        <span className="ml-auto shrink-0 pl-2 text-[13px] text-cha tabular-nums">
          {commentCount === 0 ? 'Discuss' : `${commentCount} ${commentCount === 1 ? 'reply' : 'replies'}`}
        </span>
      </div>
    </>
  )

  return (
    <Link href={`/board/${topic.id}`} className={cardClassName}>
      {cardContent}
    </Link>
  )
}
