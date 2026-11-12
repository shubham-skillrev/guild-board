'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { MEET_EVENT, meetingChannel } from '@/lib/realtime/channels'
import type { RoomState } from '@/lib/meet/activity'

/**
 * Listen to the meeting's private broadcast channel `meeting:{cycleId}`
 * (migration 046). The server sends the whole RoomState, at most once a
 * second; there's nothing to patch, so a message simply replaces the room.
 *
 * Members join with their session, /meet guests with the publishable (anon)
 * key: both may listen, only the service role sends. `connected` is false
 * until joined and whenever the channel drops, so callers poll instead.
 *
 * Separate from useLiveChannel on purpose: that one re-announces board
 * updates to GuildBot's character, which has no business with the meeting.
 */
export function useMeetingChannel(cycleId: string | null, onRoom: (room: RoomState) => void) {
  const [connected, setConnected] = useState(false)
  const handler = useRef(onRoom)
  useEffect(() => { handler.current = onRoom }, [onRoom])

  useEffect(() => {
    if (!cycleId) return
    const supabase = createClient()
    let cancelled = false
    const channel = supabase.channel(meetingChannel(cycleId), { config: { private: true } })
    channel.on('broadcast', { event: MEET_EVENT }, ({ payload }) => handler.current(payload as RoomState))
    supabase.realtime.setAuth().then(() => {
      if (cancelled) return
      channel.subscribe(status => setConnected(status === 'SUBSCRIBED'))
    })
    return () => {
      cancelled = true
      supabase.removeChannel(channel)
      setConnected(false)
    }
  }, [cycleId])

  return { connected }
}

/** The newer of two rooms (a poll and a broadcast can cross). */
export function newerRoom(a: RoomState | null | undefined, b: RoomState): RoomState {
  return a && new Date(a.at).getTime() > new Date(b.at).getTime() ? a : b
}
