'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { CATEGORY_BONUS } from '@/lib/constants'
import { useLiveChannel } from '@/hooks/useLiveChannel'
import { boardChannel, type LiveCounts, type LiveUpdate } from '@/lib/realtime/channels'
import type { Topic } from '@/types'

interface TopicsState {
  topics: Topic[]
  isLoading: boolean
  error: string | null
}

function recalcScore(t: Topic): number {
  const base = t.vote_count
  const bonus = base * (CATEGORY_BONUS[t.category] ?? 0)
  return parseFloat((base + bonus).toFixed(2))
}

const POLL_INTERVAL = 15_000

/** Apply broadcast counts to a board topic. The viewer's own flags stay as they are. */
function applyCounts(t: Topic, c: LiveCounts): Topic {
  return {
    ...t,
    vote_count: c.vote_count,
    comment_count: c.comment_count,
    score: c.score,
    signal_counts: c.signal_counts,
    poll: t.poll && c.poll_total !== null ? { ...t.poll, total_votes: c.poll_total } : t.poll,
  } as Topic
}

export function useTopics(cycleId: string | null | undefined) {
  const [state, setState] = useState<TopicsState>({
    topics: [],
    isLoading: true,
    error: null,
  })

  const fetchTopics = useCallback(async () => {
    try {
      const url = cycleId ? `/api/topics?cycle_id=${cycleId}` : '/api/topics'
      const res = await fetch(url)
      if (!res.ok) throw new Error(`Failed to fetch topics: ${res.statusText}`)
      const data: Topic[] = await res.json()
      setState({ topics: Array.isArray(data) ? data : [], isLoading: false, error: null })
    } catch (err) {
      setState(s => ({ ...s, isLoading: false, error: String(err) }))
    }
  }, [cycleId])

  useEffect(() => {
    fetchTopics()
  }, [fetchTopics])

  /* Live: the server broadcasts sanitized counts on board:{cycleId} after
     every write (src/lib/realtime/broadcast.ts). Counts are patched in place;
     a new, edited or hidden topic triggers one debounced refetch, because the
     card needs per-viewer fields the broadcast never carries. Raw table
     streams stay off: they would carry ghost authors' user_id (migration 028). */
  const refetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refetchSoon = useCallback(() => {
    if (refetchTimer.current) clearTimeout(refetchTimer.current)
    refetchTimer.current = setTimeout(fetchTopics, 300)
  }, [fetchTopics])
  useEffect(() => () => { if (refetchTimer.current) clearTimeout(refetchTimer.current) }, [])

  const onLive = useCallback((u: LiveUpdate) => {
    if (!u.topic_id || !u.counts || u.changed.includes('topics')) { refetchSoon(); return }
    const counts = u.counts
    setState(s => ({ ...s, topics: s.topics.map(t => (t.id === u.topic_id ? applyCounts(t, counts) : t)) }))
  }, [refetchSoon])

  const { connected } = useLiveChannel(cycleId ? boardChannel(cycleId) : null, onLive)

  // Fallback: poll every 15s while the live channel is down, visible tab only.
  useEffect(() => {
    if (!cycleId || connected) return
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchTopics()
    }, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [cycleId, connected, fetchTopics])

  // Optimistic vote toggle (with score recalculation - no re-sort to keep card positions stable)
  const optimisticVote = useCallback((topicId: string, delta: 1 | -1) => {
    setState(s => ({
      ...s,
      topics: s.topics.map(t => {
        if (t.id !== topicId) return t
        const updated = { ...t, vote_count: t.vote_count + delta, user_has_voted: delta === 1 } as Topic & { user_has_voted: boolean }
        updated.score = recalcScore(updated)
        return updated
      }),
    }))
  }, [])

  return { ...state, mutate: fetchTopics, optimisticVote, live: connected }
}
