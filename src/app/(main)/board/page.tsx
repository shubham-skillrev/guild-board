'use client'

import { Suspense, useCallback, useState, useEffect } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { SquaresFour, Lightbulb, Plus } from '@phosphor-icons/react/dist/ssr'
import { useCurrentCycle } from '@/hooks/useCurrentCycle'
import { useTopics } from '@/hooks/useTopics'
import { useUserTokens } from '@/hooks/useUserTokens'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { useGuestGate } from '@/components/auth/GuestGate'
import { TopicList } from '@/components/topics/TopicList'
import { SubmitModal } from '@/components/topics/SubmitModal'
import { ShareIntent } from '@/components/topics/ShareIntent'
import { MeetingPill } from '@/components/layout/MeetingPill'
import { OutcomesRecap } from '@/components/board/OutcomesRecap'
import { BytesTeaser } from '@/components/board/BytesTeaser'
import { TopContributors } from '@/components/board/TopContributors'
import { MeetingDate, CycleStatus } from '@/components/board/CycleMeta'
import { QuotaStrip } from '@/components/board/QuotaStrip'
import { ThemeBanner } from '@/components/board/ThemeBanner'
import { PageHeader, SectionHeader, EmptyState, CardSkeleton } from '@/components/ui/Section'
import { Button } from '@/components/ui/Button'
import { FOCUS_FORMAT, HIDE_BYTES } from '@/lib/experiment'
import { shareLabel } from '@/lib/themes'
import type { Cycle, Topic } from '@/types'

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export default function BoardPage() {
  const reduceMotion = useReducedMotion()
  const { user, isLoading: authLoading } = useAuth()
  const { cycle, phase, isLoading: cycleLoading } = useCurrentCycle()
  const { topics, isLoading: topicsLoading, mutate, optimisticVote, optimisticContrib } = useTopics(cycle?.id)
  const { votes_remaining, contribs_remaining, topic_submitted, isLoading: tokensLoading, refresh: refreshTokens } = useUserTokens(cycle?.id)
  const toast = useToast()
  const { blockGuest } = useGuestGate()

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
    if (blockGuest()) return
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
        if (!hasVoted) toast(FOCUS_FORMAT ? 'Marked' : 'Vote committed ⚡', 'success')
        else toast(FOCUS_FORMAT ? 'Unmarked' : 'Vote withdrawn', 'info')
        refreshTokens()
      }
    } catch {
      optimisticVote(topicId, hasVoted ? 1 : -1)
      toast('Vote failed, check your connection', 'error')
    }
  }, [optimisticVote, refreshTokens, toast, blockGuest])

  const handleContrib = useCallback(async (topicId: string, cycleId: string, hasContribed: boolean) => {
    if (blockGuest()) return
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
  }, [optimisticContrib, refreshTokens, toast, blockGuest])

  const isLoading = authLoading || cycleLoading
  const displayTopics = isViewingActive ? topics : archiveTopics
  const displayPhase = isViewingActive ? phase : 'discussion'
  const isOpen = isViewingActive && phase === 'open'
  const showRail = !FOCUS_FORMAT || !HIDE_BYTES

  /* The empty state and the page header both want to offer the same action, so
     only one of them is allowed to at a time. */
  const listIsEmpty =
    !isLoading && !topicsLoading && !archiveLoading && !!viewingCycle && displayTopics.length === 0

  const section = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        transition: { type: 'spring' as const, bounce: 0, duration: 0.4 },
      }

  return (
    <>
      {/* One page measure, one gutter, shared by the header and both columns so
          every edge on the screen lines up on the same two verticals. */}
      <div className="px-(--pad-page-x) py-8 w-full max-w-(--measure-wide) mx-auto pb-28 md:pb-10">
        {/* The cycle label is the subtitle, so the title line answers "which
            board am I looking at" and the right side answers "when is it and
            what can I do". Status reads left to right: identity, then timing,
            then state, then the one action. */}
        <PageHeader
          title="The Board"
          subtitle={
            // The theme, if the month had one, sits under it as a pill.
            viewingCycle ? viewingCycle.label : 'What shall we build next?'
          }
          action={
            <>
              {isViewingActive && <MeetingDate cycle={viewingCycle} phase={phase} />}
              {isViewingActive && <CycleStatus phase={phase} />}
              {/* One action, only while the board is open. When the list is
                  empty the empty state carries it instead, being the more
                  prominent invitation. */}
              {!listIsEmpty && isOpen && !topic_submitted && (
                <Button icon={Plus} onClick={() => setShowSubmit(true)}>
                  {shareLabel(cycle?.theme)}
                </Button>
              )}
            </>
          }
        >
          {/* Each month shows its own theme, so an archived month keeps the
              one it ran with. */}
          {viewingCycle?.theme && <ThemeBanner theme={viewingCycle.theme} />}
        </PageHeader>

        {/* ─── What you have left ───
            A strip, not a row of hero tiles. See QuotaStrip for why. */}
        {/* The focus format hides the budget: signals are uncapped and a quota
            reads as a scoreboard. */}
        {!FOCUS_FORMAT && isViewingActive && phase !== 'upcoming' && (
          <motion.section {...section} className="mb-(--gap-section)" aria-label="What you have left this cycle">
            <QuotaStrip
              votesRemaining={isOpen ? votes_remaining : 0}
              contribsRemaining={isOpen ? contribs_remaining : 0}
              topicSubmitted={topic_submitted}
            />
          </motion.section>
        )}

        {/* ─── Two columns from lg up ───
            The topic list is the reason the page exists, so it takes the wide
            column and keeps a comfortable reading measure. The rail carries
            what is worth glancing at but never worth scrolling for.
            Below lg it is one column and the rail falls under the list, which
            is the correct priority order on a phone rather than an accident of
            source order. */}
        <div className={!showRail
          ? 'grid grid-cols-1 gap-y-(--gap-section) items-start'
          : 'grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] gap-x-10 gap-y-(--gap-section) items-start'}>
          <div className="min-w-0 space-y-(--gap-section)">
          {/* ─── What came of last cycle ─── */}
          <OutcomesRecap />

          {/* ─── Topics ─── */}
          <motion.section {...section} aria-labelledby="board-topics">
            <SectionHeader
              id="board-topics"
              title={isViewingActive ? 'On the board' : `${viewingCycle?.label ?? 'Archive'}`}
              hint={
                displayTopics.length > 0
                  ? `${displayTopics.length} ${displayTopics.length === 1
                      ? 'discussion'
                      : 'discussions'}`
                  : undefined
              }
            />

            {/* Cycle history. Secondary to the current board, so it sits with
                the list it filters rather than at the top of the page. */}
            {allCycles.length > 1 && (
              <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1 -mx-1 px-1">
                {allCycles.map(c => {
                  const isActive = c.id === viewingCycleId
                  const isCurrent = c.id === activeCycleId
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCycleId(c.id === activeCycleId ? null : c.id)}
                      aria-pressed={isActive}
                      /* Full-size tabs, not micro-chips. These are the primary
                         way to move around a year of cycles, and at caption
                         size they read as a footnote about the list rather
                         than a control over it. The live cycle keeps a hint of
                         saffron even when you are looking at an old one, so
                         "where is now" never needs hunting for. */
                      className={`press shrink-0 inline-flex items-center h-9 px-3.5 rounded-full text-footnote font-medium transition-colors ${
                        isActive
                          ? 'bg-sumi text-saffron border border-border-strong'
                          : 'border border-transparent text-cha hover:text-ink hover:bg-kinu/50'
                      } ${isCurrent && !isActive ? 'text-saffron/60' : ''}`}
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
                icon={SquaresFour}
                title="The board opens soon"
                body="An admin opens the board for each month's session. Check back shortly."
              />
            ) : topicsLoading || archiveLoading ? (
              <CardSkeleton />
            ) : displayTopics.length === 0 ? (
              <EmptyState
                icon={Lightbulb}
                title="Nothing here yet"
                body={
                  isOpen
                    ? `Be the first. ${viewingCycle?.theme?.open_line ?? 'One good question is enough to start a cycle.'}`
                    : 'This cycle came and went without a post.'
                }
                action={
                  isOpen && !topic_submitted ? (
                    <Button icon={Plus} onClick={() => setShowSubmit(true)}>
                      {shareLabel(cycle?.theme)}
                    </Button>
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
          </div>

          {/* ─── Rail ───
              Glanceable, never load-bearing. It sticks below the header on a
              pointer so it stays with you down a long topic list, and it is a
              plain stacked column on a phone. */}
          {/* The focus format hides the contributor ranking: it muddies what is
              being measured. Bytes has its own switch. */}
          {showRail && (
            <aside className="min-w-0 space-y-(--gap-section) lg:sticky lg:top-20">
              {!FOCUS_FORMAT && <TopContributors topics={displayTopics as Topic[]} />}
              {!HIDE_BYTES && <BytesTeaser />}
            </aside>
          )}
        </div>
      </div>

      {showSubmit && cycle && (
        <SubmitModal
          cycle={cycle}
          onClose={() => setShowSubmit(false)}
          onSubmitted={() => { setShowSubmit(false); mutate(); refreshTokens() }}
        />
      )}

      <Suspense fallback={null}>
        <ShareIntent
          cycle={cycle}
          canShare={!showSubmit && isOpen && !tokensLoading && !topic_submitted}
          onSubmitted={() => { mutate(); refreshTokens() }}
        />
      </Suspense>

      {isViewingActive && <MeetingPill cycle={viewingCycle} phase={phase} />}
    </>
  )
}
