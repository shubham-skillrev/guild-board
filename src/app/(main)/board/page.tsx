'use client'

import { useCallback, useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, useReducedMotion } from 'framer-motion'
import {
  ArrowBigUp, Calendar, CircleCheck, Handshake, LayoutGrid, Lightbulb, MessageSquare,
} from 'lucide-react'
import { Icon } from '@/components/ui/Icon'
import { useCurrentCycle } from '@/hooks/useCurrentCycle'
import { useTopics } from '@/hooks/useTopics'
import { useUserTokens } from '@/hooks/useUserTokens'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { TopicList } from '@/components/topics/TopicList'
import { SubmitModal } from '@/components/topics/SubmitModal'
import { MeetingPill } from '@/components/layout/MeetingPill'
import { OutcomesRecap } from '@/components/board/OutcomesRecap'
import { BytesTeaser } from '@/components/board/BytesTeaser'
import { PageHeader, SectionHeader, StatTile, EmptyState, CardSkeleton } from '@/components/ui/Section'
import { Button } from '@/components/ui/Button'
import type { Cycle, Topic } from '@/types'

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

/** Whole days until the meeting. Negative once it has passed. */
function daysUntil(meetingAt: string | null | undefined): number | null {
  if (!meetingAt) return null
  const ms = new Date(meetingAt).getTime() - Date.now()
  return Math.ceil(ms / 86_400_000)
}

export default function BoardPage() {
  const reduceMotion = useReducedMotion()
  const { user, isLoading: authLoading } = useAuth()
  const { cycle, phase, isLoading: cycleLoading } = useCurrentCycle()
  const { topics, isLoading: topicsLoading, mutate, optimisticVote, optimisticContrib } = useTopics(cycle?.id)
  const { votes_remaining, contribs_remaining, topic_submitted, refresh: refreshTokens } = useUserTokens(cycle?.id)
  const toast = useToast()

  const [allCycles, setAllCycles] = useState<Cycle[]>([])
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null)
  const [archiveTopics, setArchiveTopics] = useState<Topic[]>([])
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [showSubmit, setShowSubmit] = useState(false)

  useEffect(() => {
    fetch('/api/cycles?all=true')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setAllCycles(data)
        else if (data.cycles) setAllCycles(data.cycles)
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    if (!selectedCycleId || selectedCycleId === cycle?.id) {
      setArchiveTopics([])
      return
    }
    setArchiveLoading(true)
    fetch(`/api/topics?cycle_id=${selectedCycleId}`)
      .then(r => r.json())
      .then(data => setArchiveTopics(Array.isArray(data) ? data : data.topics ?? []))
      .catch(() => setArchiveTopics([]))
      .finally(() => setArchiveLoading(false))
  }, [selectedCycleId, cycle?.id])

  const activeCycleId = cycle?.id ?? null
  const viewingCycleId = selectedCycleId ?? activeCycleId
  const isViewingActive = viewingCycleId === activeCycleId
  const viewingCycle = allCycles.find(c => c.id === viewingCycleId) ?? cycle

  const handleVote = useCallback(async (topicId: string, cycleId: string, hasVoted: boolean) => {
    optimisticVote(topicId, hasVoted ? -1 : 1)
    try {
      const res = await fetch('/api/votes', {
        method: hasVoted ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hasVoted ? { topic_id: topicId } : { topic_id: topicId, cycle_id: cycleId }),
      })
      if (!res.ok) {
        optimisticVote(topicId, hasVoted ? 1 : -1)
        const data = await res.json().catch(() => ({}))
        toast(data.error ?? 'Vote failed', 'error')
      } else {
        if (!hasVoted) toast('Vote committed ⚡', 'success')
        else toast('Vote withdrawn', 'info')
        refreshTokens()
      }
    } catch {
      optimisticVote(topicId, hasVoted ? 1 : -1)
      toast('Vote failed, check your connection', 'error')
    }
  }, [optimisticVote, refreshTokens, toast])

  const handleContrib = useCallback(async (topicId: string, cycleId: string, hasContribed: boolean) => {
    optimisticContrib(topicId, hasContribed ? -1 : 1)
    try {
      const res = await fetch('/api/contributions', {
        method: hasContribed ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(hasContribed ? { topic_id: topicId } : { topic_id: topicId, cycle_id: cycleId }),
      })
      if (!res.ok) {
        optimisticContrib(topicId, hasContribed ? 1 : -1)
        const data = await res.json().catch(() => ({}))
        toast(data.error ?? 'Failed to update', 'error')
      } else {
        if (!hasContribed) toast("You're in 🤝", 'success')
        else toast('Stepped back', 'info')
        refreshTokens()
      }
    } catch {
      optimisticContrib(topicId, hasContribed ? 1 : -1)
      toast('Failed to update, check your connection', 'error')
    }
  }, [optimisticContrib, refreshTokens, toast])

  const isLoading = authLoading || cycleLoading
  const displayTopics = isViewingActive ? topics : archiveTopics
  const displayPhase = isViewingActive ? phase : 'discussion'
  const days = daysUntil(viewingCycle?.meeting_at)
  const isOpen = isViewingActive && phase === 'open'

  const section = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        transition: { type: 'spring' as const, bounce: 0, duration: 0.4 },
      }

  return (
    <>
      <div className="px-5 md:px-10 py-8 w-full max-w-5xl mx-auto pb-28 md:pb-10">
        <PageHeader
          title="The Board"
          subtitle={
            viewingCycle
              ? isViewingActive
                ? phase === 'open'
                  ? 'Open for pitches and votes.'
                  : 'Voting is closed. Discussion and sparks are live.'
                : `Viewing ${viewingCycle.label}.`
              : 'What shall we build next?'
          }
          action={
            <>
              {isOpen && !topic_submitted && (
                <Button onClick={() => setShowSubmit(true)}>Pitch an idea</Button>
              )}
              <Link
                href="/bank"
                className="press inline-flex items-center gap-1.5 px-3.5 py-2 border border-border-strong text-ink-soft text-[13px] font-semibold rounded-lg hover:bg-kinu transition-colors"
              >
                <Icon icon={Lightbulb} /> Bank an idea
              </Link>
            </>
          }
        />

        {/* ─── Status strip ───
            The dashboard answer to "where are we and what do I still have".
            Everything here is a number the member can act on. */}
        {isViewingActive && phase !== 'upcoming' && (
          <motion.section {...section} className="mb-7" aria-label="Your cycle status">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <StatTile
                icon={phase === 'open' ? Calendar : MessageSquare}
                value={
                  days === null ? '-' : days > 0 ? days : days === 0 ? 'Today' : 'Done'
                }
                label={
                  days === null
                    ? 'No meeting set'
                    : days > 1
                      ? 'days to meeting'
                      : days === 1
                        ? 'day to meeting'
                        : days === 0
                          ? 'meeting day'
                          : 'discussion mode'
                }
                tone={days !== null && days >= 0 && days <= 2 ? 'active' : 'default'}
              />
              <StatTile
                icon={ArrowBigUp}
                value={votes_remaining}
                label={votes_remaining === 1 ? 'vote left' : 'votes left'}
                tone={!isOpen ? 'spent' : votes_remaining > 0 ? 'active' : 'spent'}
              />
              <StatTile
                icon={Handshake}
                value={contribs_remaining}
                label={contribs_remaining === 1 ? 'hand raise' : 'hand raises'}
                tone={!isOpen ? 'spent' : contribs_remaining > 0 ? 'active' : 'spent'}
              />
              <StatTile
                icon={topic_submitted ? CircleCheck : Lightbulb}
                value={topic_submitted ? '1' : '0'}
                label={topic_submitted ? 'idea pitched' : 'ideas pitched'}
                tone={topic_submitted ? 'default' : isOpen ? 'active' : 'spent'}
                href={topic_submitted ? undefined : '/bank'}
              />
            </div>
          </motion.section>
        )}

        <div className="space-y-8">
          {/* ─── What came of last cycle ─── */}
          <OutcomesRecap />

          {/* ─── Topics ─── */}
          <motion.section {...section} aria-labelledby="board-topics">
            <SectionHeader
              id="board-topics"
              title={isViewingActive ? 'On the board' : `${viewingCycle?.label ?? 'Archive'}`}
              hint={
                displayTopics.length > 0
                  ? `${displayTopics.length} ${displayTopics.length === 1 ? 'topic' : 'topics'}`
                  : undefined
              }
            />

            {/* Cycle history. Secondary to the current board, so it sits with
                the list it filters rather than at the top of the page. */}
            {allCycles.length > 1 && (
              <div className="flex items-center gap-1.5 mb-4 overflow-x-auto pb-1 -mx-1 px-1">
                {allCycles.map(c => {
                  const isActive = c.id === viewingCycleId
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCycleId(c.id === activeCycleId ? null : c.id)}
                      aria-pressed={isActive}
                      className={`press shrink-0 px-3 py-1.5 rounded-full type-caption transition-colors border ${
                        isActive
                          ? 'bg-sumi text-saffron border-border-strong'
                          : 'text-cha hover:text-ink hover:bg-kinu/50 border-transparent'
                      }`}
                    >
                      {MONTHS_SHORT[c.month - 1]} {c.year}
                    </button>
                  )
                })}
              </div>
            )}

            {isLoading ? (
              <CardSkeleton />
            ) : !viewingCycle ? (
              <EmptyState
                icon={LayoutGrid}
                title="The scroll is blank"
                body="An admin needs to open a cycle to get the guild rolling. Ideas you bank now carry over."
                action={
                  <Link
                    href="/bank"
                    className="press inline-flex items-center gap-1.5 px-3.5 py-2 border border-border-strong text-ink-soft text-[13px] font-semibold rounded-lg hover:bg-kinu transition-colors"
                  >
                    <Icon icon={Lightbulb} /> Bank an idea
                  </Link>
                }
              />
            ) : topicsLoading || archiveLoading ? (
              <CardSkeleton />
            ) : displayTopics.length === 0 ? (
              <EmptyState
                icon={Lightbulb}
                title="Nothing pitched yet"
                body={
                  isOpen
                    ? 'Be the first. One good question is enough to start a cycle.'
                    : 'This cycle came and went without a pitch.'
                }
                action={
                  isOpen && !topic_submitted ? (
                    <Button onClick={() => setShowSubmit(true)}>Pitch an idea</Button>
                  ) : undefined
                }
              />
            ) : (
              <TopicList
                topics={displayTopics as any}
                phase={displayPhase}
                cycleId={viewingCycleId!}
                currentUserId={user?.id}
                votesRemaining={isViewingActive ? votes_remaining : 0}
                contribsRemaining={isViewingActive ? contribs_remaining : 0}
                onVote={handleVote}
                onContrib={handleContrib}
              />
            )}
          </motion.section>

          {/* ─── This week in tech ─── */}
          <BytesTeaser />
        </div>
      </div>

      {showSubmit && cycle && (
        <SubmitModal
          cycle={cycle}
          onClose={() => setShowSubmit(false)}
          onSubmitted={() => { setShowSubmit(false); mutate(); refreshTokens() }}
        />
      )}

      {isViewingActive && <MeetingPill cycle={viewingCycle} phase={phase} />}
    </>
  )
}
