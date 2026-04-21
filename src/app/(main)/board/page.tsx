'use client'

import { useCallback, useState, useEffect } from 'react'
import { useCurrentCycle } from '@/hooks/useCurrentCycle'
import { useTopics } from '@/hooks/useTopics'
import { useUserTokens } from '@/hooks/useUserTokens'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { TopicList } from '@/components/topics/TopicList'
import { SubmitModal } from '@/components/topics/SubmitModal'
import { MeetingPill, MeetingDateBadge } from '@/components/layout/MeetingPill'
import type { Cycle, Topic } from '@/types'

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export default function BoardPage() {
  const { user, isLoading: authLoading } = useAuth()
  const { cycle, phase, isLoading: cycleLoading } = useCurrentCycle()
  const { topics, isLoading: topicsLoading, mutate, optimisticVote, optimisticContrib } = useTopics(cycle?.id)
  const { votes_remaining, contribs_remaining, topic_submitted, refresh: refreshTokens } = useUserTokens(cycle?.id)
  const toast = useToast()

  // All cycles for tabs
  const [allCycles, setAllCycles] = useState<Cycle[]>([])
  const [selectedCycleId, setSelectedCycleId] = useState<string | null>(null)
  const [archiveTopics, setArchiveTopics] = useState<Topic[]>([])
  const [archiveLoading, setArchiveLoading] = useState(false)
  const [showSubmit, setShowSubmit] = useState(false)

  // Fetch all cycles for tabs
  useEffect(() => {
    fetch('/api/cycles?all=true')
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) setAllCycles(data)
        else if (data.cycles) setAllCycles(data.cycles)
      })
      .catch(() => {})
  }, [])

  // When a closed/upcoming cycle tab is selected, fetch its topics
  useEffect(() => {
    if (!selectedCycleId || selectedCycleId === cycle?.id) {
      setArchiveTopics([])
      return
    }
    setArchiveLoading(true)
    fetch(`/api/topics?cycle_id=${selectedCycleId}`)
      .then(r => r.json())
      .then(data => {
        setArchiveTopics(Array.isArray(data) ? data : data.topics ?? [])
      })
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
        if (!hasVoted) toast('Vote committed to the ledger ⚡', 'success')
        else toast('Vote withdrawn', 'info')
        refreshTokens()
      }
    } catch {
      optimisticVote(topicId, hasVoted ? 1 : -1)
      toast('Vote failed — check your connection', 'error')
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
        if (!hasContribed) toast("You're in the arena 🤝", 'success')
        else toast('Stepped back from discussion', 'info')
        refreshTokens()
      }
    } catch {
      optimisticContrib(topicId, hasContribed ? 1 : -1)
      toast('Failed to update — check your connection', 'error')
    }
  }, [optimisticContrib, refreshTokens, toast])

  const isLoading = authLoading || cycleLoading
  const displayTopics = isViewingActive ? topics : archiveTopics
  const displayPhase = isViewingActive ? phase : 'discussion'

  return (
    <>
      <div className="px-5 md:px-10 py-8 w-full max-w-5xl mx-auto">
        {/* ─── Page Header ─── */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-6 gap-3">
          <div>
            <h1 className="font-serif text-2xl font-bold text-ink tracking-tight">
              The Board
            </h1>
            <p className="text-[13px] text-ink-soft mt-0.5">
              {viewingCycle ? viewingCycle.label : 'What shall we build next?'}
            </p>
          </div>
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            {/* Meeting date badge (inline, > 48h away) */}
            {isViewingActive && (
              <MeetingDateBadge cycle={viewingCycle} phase={phase} />
            )}
            {/* Phase pill */}
            {isViewingActive && phase !== 'upcoming' && (
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${
                  phase === 'open' ? 'bg-matcha-light text-matcha' :
                  'bg-indigo-light text-indigo-jp'
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    phase === 'open' ? 'bg-matcha animate-pulse-soft' :
                    'bg-indigo-jp'
                  }`} />
                  {phase === 'open' ? 'Open for votes' : 'Discussion mode'}
                </span>
              </div>
            )}
            {/* Submit CTA */}
            {isViewingActive && phase === 'open' && !topic_submitted && (
              <button
                onClick={() => setShowSubmit(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-saffron text-parchment text-[13px] font-semibold rounded-lg hover:bg-saffron/90 transition-all shadow-[0_0_20px_rgba(232,145,58,0.15)]"
              >
                Pitch an Idea
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* ─── Cycle tabs — Peerlist week-style ─── */}
        {allCycles.length > 0 && (
          <div className="flex items-center gap-1 mb-5 overflow-x-auto pb-1 -mx-1 px-1">
            {allCycles.map((c) => {
              const isActive = c.id === viewingCycleId
              const isCurrent = c.id === activeCycleId
              return (
                <button
                  key={c.id}
                  onClick={() => setSelectedCycleId(c.id === activeCycleId ? null : c.id)}
                  className={`shrink-0 px-3.5 py-1.5 rounded-full text-[13px] font-medium transition-all ${
                    isActive
                      ? 'bg-sumi text-saffron border border-border-strong'
                      : 'text-cha hover:text-ink hover:bg-kinu/50 border border-transparent'
                  } ${isCurrent && !isActive ? 'text-saffron/50' : ''}`}
                >
                  {MONTHS_SHORT[c.month - 1]} {c.year}
                </button>
              )
            })}
          </div>
        )}

        {/* ─── Token bar — your remaining actions ─── */}
        {isViewingActive && phase === 'open' && (
          <div className="flex flex-wrap items-center gap-2 mb-5 px-3 py-2.5 bg-paper/60 border border-border rounded-lg text-[12px]">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-kinu/50 text-ink-soft">
              <span className="text-saffron text-xs">▲</span>
              {votes_remaining} vote{votes_remaining !== 1 ? 's' : ''} left
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-kinu/50 text-ink-soft">
              <span className="text-matcha text-xs">🤝</span>
              {contribs_remaining} hand raise{contribs_remaining !== 1 ? 's' : ''} left
            </span>
            {topic_submitted && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-kinu/50 text-cha">
                Idea pitched ✓
              </span>
            )}
          </div>
        )}

        {/* ─── Topic list ─── */}
        {isLoading ? (
          <div className="text-center py-20 text-cha text-sm animate-pulse-soft">Loading...</div>
        ) : !viewingCycle ? (
          <div className="text-center py-24">
            <div className="text-saffron text-3xl mb-4">◈</div>
            <p className="text-base font-medium text-ink-soft">The scroll is blank</p>
            <p className="text-sm mt-1 text-cha">
              An admin needs to open a cycle to get the guild rolling.
            </p>
          </div>
        ) : (topicsLoading || archiveLoading) ? (
          <div className="space-y-3 animate-pulse">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div key={idx} className="bg-paper/50 border border-border rounded-xl p-4">
                <div className="flex gap-3">
                  <div className="flex-1 min-w-0 space-y-2">
                    <div className="h-5 w-28 bg-kinu/70 rounded-full" />
                    <div className="h-4 w-3/4 bg-kinu/70 rounded" />
                    <div className="h-4 w-1/2 bg-kinu/50 rounded" />
                    <div className="h-3 w-32 bg-kinu/50 rounded" />
                  </div>
                  <div className="w-12 space-y-2 shrink-0">
                    <div className="h-16 bg-kinu/70 rounded-xl" />
                    <div className="h-9 bg-kinu/60 rounded-lg" />
                  </div>
                </div>
              </div>
            ))}
          </div>
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
      </div>

      {/* Submit modal */}
      {showSubmit && cycle && (
        <SubmitModal
          cycle={cycle}
          onClose={() => setShowSubmit(false)}
          onSubmitted={() => { setShowSubmit(false); mutate(); refreshTokens() }}
        />
      )}

      {/* Floating meeting countdown pill */}
      {isViewingActive && (
        <MeetingPill cycle={viewingCycle} phase={phase} />
      )}
    </>
  )
}
