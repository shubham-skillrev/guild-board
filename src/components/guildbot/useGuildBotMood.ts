'use client'

import { useEffect, useState } from 'react'
import { moodFor, type Mood } from '@guildboard/guildbot'
import { useCurrentCycle } from '@/hooks/useCurrentCycle'
import { botSays } from '@/lib/guildbot-host/voice'

const DAY = 86_400_000

/**
 * GuildBot's mood, wherever its button is (board, topic and Bytes pages), from
 * this month's topic counts: how long the board has been open and how many
 * humans have posted next to the bot. Counts only, so it names nobody.
 * Smug until the counts arrive.
 */
export function useGuildBotMood(): { mood: Mood; line: string | null } {
  const { cycle } = useCurrentCycle()
  const [state, setState] = useState<{ mood: Mood; line: string | null }>({ mood: 'smug', line: null })

  useEffect(() => {
    if (!cycle?.id) return
    let cancelled = false
    fetch(`/api/topics?cycle_id=${cycle.id}`)
      .then(r => (r.ok ? r.json() : []))
      .then((topics: { is_system?: boolean }[]) => {
        if (cancelled || !Array.isArray(topics)) return
        const now = Date.now()
        const daysSinceOpen = Math.max(0, Math.floor((now - new Date(cycle.opens_at ?? cycle.created_at).getTime()) / DAY))
        const daysToMeeting = cycle.meeting_at ? Math.ceil((new Date(cycle.meeting_at).getTime() - now) / DAY) : null
        const botPosts = topics.filter(t => t.is_system).length
        const humanPosts = topics.length - botPosts
        const mood = moodFor({ daysSinceOpen, daysToMeeting, humanPosts, botPosts })
        setState({ mood, line: botSays(`mood.${mood}`, cycle.id, 'ui', { posts: humanPosts, days: daysSinceOpen }) })
      })
      .catch(() => {})
    return () => { cancelled = true }
  }, [cycle])

  return state
}
