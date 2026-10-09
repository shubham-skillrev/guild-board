'use client'

import { useEffect, useState, useCallback } from 'react'
import { CATEGORY_BONUS } from '@/lib/constants'
import type { Topic } from '@/types'

interface TopicsState {
  topics: Topic[]
  isLoading: boolean
  error: string | null
}

function recalcScore(t: Topic): number {
  const base = t.vote_count * 1 + t.contrib_count * 2
  const bonus = base * (CATEGORY_BONUS[t.category] ?? 0)
  return parseFloat((base + bonus).toFixed(2))
}

const POLL_INTERVAL = 15_000

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

  /* Polling, not postgres_changes. Raw row events carry every column, ghost
     authors' user_id included, so topics left the realtime publication in
     migration 028. Live updates come back as a sanitized server broadcast;
     until then the board refreshes every 15s, and only while visible. */
  useEffect(() => {
    if (!cycleId) return
    const interval = setInterval(() => {
      if (document.visibilityState === 'visible') fetchTopics()
    }, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [cycleId, fetchTopics])

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

  // Optimistic contrib toggle (with score recalculation - no re-sort to keep card positions stable)
  const optimisticContrib = useCallback((topicId: string, delta: 1 | -1) => {
    setState(s => ({
      ...s,
      topics: s.topics.map(t => {
        if (t.id !== topicId) return t
        const updated = { ...t, contrib_count: t.contrib_count + delta, user_has_contribed: delta === 1 } as Topic & { user_has_contribed: boolean }
        updated.score = recalcScore(updated)
        return updated
      }),
    }))
  }, [])

  return { ...state, mutate: fetchTopics, optimisticVote, optimisticContrib }
}
