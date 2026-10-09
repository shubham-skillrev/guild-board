'use client'

import { useState } from 'react'
import { moodFor } from '@guildboard/guildbot'
import { botSays, BOT_MARK } from '@/lib/guildbot-host/voice'
import type { Cycle, Topic } from '@/types'

const DAY = 86_400_000

/**
 * One line under the board title: how GuildBot feels about the month so far.
 * Counts only, from the topics already on screen, so it names nobody and
 * costs no request. Hidden when the voice is switched off.
 */
export function GuildBotMood({ cycle, topics }: { cycle: Cycle; topics: Topic[] }) {
  // Read once on mount: the mood works in whole days, so it never needs a tick.
  const [now] = useState(() => Date.now())
  const opened = new Date(cycle.opens_at ?? cycle.created_at).getTime()
  const daysSinceOpen = Math.max(0, Math.floor((now - opened) / DAY))
  const daysToMeeting = cycle.meeting_at
    ? Math.ceil((new Date(cycle.meeting_at).getTime() - now) / DAY)
    : null
  const botPosts = topics.filter(t => t.is_system).length
  const humanPosts = topics.length - botPosts

  const mood = moodFor({ daysSinceOpen, daysToMeeting, humanPosts, botPosts })
  const text = botSays(`mood.${mood}`, cycle.id, 'ui', { posts: humanPosts, days: daysSinceOpen })
  if (!text) return null

  return (
    <p className="mt-2 inline-flex items-center gap-1.5 text-[12px] text-cha" aria-label={`GuildBot says: ${text}`}>
      <span aria-hidden className="text-saffron">{BOT_MARK}</span>
      {text}
    </p>
  )
}
