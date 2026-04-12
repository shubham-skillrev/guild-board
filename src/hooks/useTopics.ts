'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
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

const POLL_INTERVAL = 15_000 // 15s polling fallback

export function useTopics(cycleId: string | null | undefined) {
  const [state, setState] = useState<TopicsState>({
    topics: [],
    isLoading: true,
    error: null,
  })
  const channelRef = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const realtimeActive = useRef(false)

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

  // Realtime subscription — updates vote/contrib/score in place without refetch
  useEffect(() => {
    if (!cycleId) return

    const supabase = createClient()
    channelRef.current?.unsubscribe()
    realtimeActive.current = false

    channelRef.current = supabase
      .channel(`topics:cycle_id=eq.${cycleId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'topics', filter: `cycle_id=eq.${cycleId}` },
        payload => {
          if (payload.eventType === 'INSERT') {
            // New topic added — full refetch to get author info
            fetchTopics()
          } else if (payload.eventType === 'UPDATE') {
            setState(s => ({
              ...s,
              topics: s.topics
                .map(t => t.id === payload.new.id
                  ? { ...t, vote_count: payload.new.vote_count, contrib_count: payload.new.contrib_count, score: payload.new.score }
                  : t
                )
                .sort((a, b) => b.score - a.score),
            }))
          }
        }
      )
      .subscribe((status) => {
        realtimeActive.current = status === 'SUBSCRIBED'
      })

    return () => {
      channelRef.current?.unsubscribe()
      realtimeActive.current = false
    }
  }, [cycleId, fetchTopics])

  // Polling fallback — if realtime is not active, poll every 15s
  useEffect(() => {
    if (!cycleId) return
    const interval = setInterval(() => {
      if (!realtimeActive.current) fetchTopics()
    }, POLL_INTERVAL)
    return () => clearInterval(interval)
  }, [cycleId, fetchTopics])

  // Optimistic vote toggle (with score recalculation)
  const optimisticVote = useCallback((topicId: string, delta: 1 | -1) => {
    setState(s => ({
      ...s,
      topics: s.topics
        .map(t => {
          if (t.id !== topicId) return t
          const updated = { ...t, vote_count: t.vote_count + delta, user_has_voted: delta === 1 } as Topic & { user_has_voted: boolean }
          updated.score = recalcScore(updated)
          return updated
        })
        .sort((a, b) => b.score - a.score),
    }))
  }, [])

  // Optimistic contrib toggle (with score recalculation)
  const optimisticContrib = useCallback((topicId: string, delta: 1 | -1) => {
    setState(s => ({
      ...s,
      topics: s.topics
        .map(t => {
          if (t.id !== topicId) return t
          const updated = { ...t, contrib_count: t.contrib_count + delta, user_has_contribed: delta === 1 } as Topic & { user_has_contribed: boolean }
          updated.score = recalcScore(updated)
          return updated
        })
        .sort((a, b) => b.score - a.score),
    }))
  }, [])

  return { ...state, mutate: fetchTopics, optimisticVote, optimisticContrib }
}
