'use client'

import { ArrowFatUp, ChatCircle, Handshake } from '@phosphor-icons/react/dist/ssr'
import { useState } from 'react'
import Link from 'next/link'
import { SignalRow } from '@/components/topics/SignalRow'
import { cn } from '@/lib/utils/cn'
import { CATEGORY_LABELS } from '@/lib/constants'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { Badge } from '@/components/ui/Badge'
import type { Topic } from '@/types'

type BadgeTone = React.ComponentProps<typeof Badge>['tone']
import type { CyclePhase } from '@/hooks/useCurrentCycle'

const CATEGORY_TONE: Record<string, BadgeTone> = {
  deep_dive: 'indigo',
  discussion: 'saffron',
  blog_idea: 'matcha',
  project_showcase: 'wisteria',
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

  // Server-computed: topic.user_id is absent on ghost topics, so ownership
  // cannot be derived client-side. Falls back to the id compare for any
  // payload that predates the anonymity serializer.
  const isOwner = topic.is_owner ?? currentUserId === topic.user_id
  const canVote = phase === 'open' && !isOwner
  const canContrib = phase === 'open' && !isOwner
  const categoryTone = CATEGORY_TONE[topic.category] ?? 'saffron'
  const commentCount = (topic as Topic & { comment_count?: number }).comment_count ?? 0
  const withSignals = topic as Topic & {
    signal_counts?: Record<string, number>
    my_signals?: string[]
  }
  const signalCounts = withSignals.signal_counts ?? {}
  const mySignals = withSignals.my_signals ?? []
  /* Truncation is CSS's job, not a character count's. A fixed 52-char slice cut
     mid-word well short of the card's actual width and then CSS clipped what
     was left, so a title lost two words it had room for. `truncate` ellipsizes
     at the real edge, whatever the viewport is. */

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
    'group flex gap-3 sm:gap-4 bg-paper/50 border border-border rounded-(--radius-card) p-(--pad-card) transition-colors press',
    'hover:border-border-strong hover:bg-paper/80',
    topic.is_selected && 'ring-1 ring-saffron/30 border-saffron/20',
    (votePending || contribPending) && 'opacity-75',
  )

  const cardContent = (
    <>
      {/* Rank */}
      {/* Medals for the podium. This is a monthly contest between colleagues,
          and the top three being visibly the top three is the point of ranking
          them at all. */}
      <div className="hidden sm:flex flex-col items-center pt-0.5 shrink-0 w-8">
        <span className={cn(
          'text-sm font-semibold tabular',
          rank <= 3 ? 'text-saffron' : 'text-cha',
        )}>
          {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : `#${rank}`}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 space-y-1.5">
        {/* Badges */}
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge tone={categoryTone} dot>{CATEGORY_LABELS[topic.category]}</Badge>
          {topic.status === 'carry_forward' && <Badge tone="indigo">↩ Returning</Badge>}
          {topic.is_selected && <Badge tone="saffron">★ Selected</Badge>}
        </div>

        {/* Title and blurb are one line each. A board is a list you scan for
            the one topic you care about, and two wrapped lines per field turned
            six cards into a page and a half of scrolling. The full text is one
            tap away. */}
        {/* The display serif, on purpose. It is the page voice everywhere else
            in the product, and a board is a list of titles - the one place a
            card title is the content rather than a label on it. */}
        <h3 className="font-serif text-title-3 text-ink group-hover:text-saffron transition-colors truncate">
          {topic.title}
        </h3>

        <p className="text-body text-ink-soft truncate">
          {topic.description}
        </p>

        {/* One metadata line: who, how much talk, and the one-tap signals.
            The signals used to sit in a row of their own under this, four
            labelled pills wide, which read as a second card stapled to the
            first. Compact mode drops the labels so they weigh the same as the
            comment count they sit beside. */}
        <div className="flex items-center gap-3 pt-1 flex-wrap">
          <div className="flex items-center gap-1.5">
            <UserAvatar username={topic.author_username ?? 'user'} size={18} />
            <span className="type-caption text-ink-soft">@{topic.author_username}</span>
          </div>
          <span className="inline-flex items-center gap-1 type-caption text-cha">
            <ChatCircle className="w-3.5 h-3.5" />
            {commentCount > 0 ? commentCount : 'Discuss'}
          </span>
          <SignalRow
            topicId={topic.id}
            compact
            initialCounts={signalCounts}
            initialMine={mySignals}
          />
        </div>
      </div>

      <div className="flex flex-col items-center gap-1.5 shrink-0 pt-0.5 justify-end">
        <button
          onClick={handleVote}
          disabled={!canVote || voteDisabled}
          aria-label={hasVoted ? 'Remove vote' : 'Upvote'}
          className={cn(
            /* The two counters are the whole reason a member opens the board on
               a phone, so they are sized as thumb targets first: 48x60 on
               touch, trimmed to 44x56 where there is a cursor. */
            'flex flex-col items-center justify-center gap-0.5 w-12 sm:w-11 h-15 sm:h-14 rounded-(--radius-card) border text-center transition-colors',
            hasVoted
              ? 'bg-saffron/15 border-saffron/50 text-saffron'
              : canVote && !voteDisabled
                ? 'bg-kinu/40 border-border text-ink-soft hover:border-saffron/45 hover:text-saffron hover:bg-saffron/10'
                : 'border-border text-ink-muted',
            votePending
              ? 'opacity-60 cursor-wait'
              : canVote && !voteDisabled
                ? 'cursor-pointer'
                : 'cursor-not-allowed',
          )}
        >
          {votePending ? (
            <span className="w-4 h-4 rounded-full border-2 border-current border-t-transparent animate-spin-fast" />
          ) : hasVoted ? (
            <ArrowFatUp className="w-5 h-5" weight="fill" />
          ) : (
            <ArrowFatUp className="w-5 h-5" />
          )}
          <span className="text-[15px] font-bold tabular-nums leading-none">{topic.vote_count}</span>
        </button>

        <button
          onClick={handleContrib}
          disabled={!canContrib || contribDisabled}
          aria-label={hasContributed ? 'Withdraw' : "I'll contribute"}
          className={cn(
            'flex items-center justify-center gap-1 w-12 sm:w-11 h-10 sm:h-9 rounded-(--radius-control) border text-footnote font-medium transition-colors',
            hasContributed
              ? 'bg-matcha/15 border-matcha/50 text-matcha'
              : canContrib && !contribDisabled
                ? 'bg-kinu/40 border-border text-ink-soft hover:border-matcha/45 hover:text-matcha hover:bg-matcha/10'
                : 'border-border text-ink-muted',
            contribPending
              ? 'opacity-60 cursor-wait'
              : canContrib && !contribDisabled
                ? 'cursor-pointer'
                : 'cursor-not-allowed',
          )}
        >
          {contribPending ? (
            <span className="w-3 h-3 rounded-full border-2 border-current border-t-transparent animate-spin-fast" />
          ) : (
            <Handshake className={cn('w-4 h-4', hasContributed && 'scale-110')} />
          )}
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
