'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { LIVE_EVENT, type LiveUpdate } from '@/lib/realtime/channels'

/**
 * Listen to one private live channel (see src/lib/realtime/channels.ts).
 *
 * One subscription per page: two components opening the same channel name on
 * one client would tear each other down on unmount, so a page subscribes once
 * and hands updates to its children.
 *
 * With `presence`, the tab joins the channel's presence under a random key
 * and `present` counts the tabs there. No name or user id is ever tracked, so
 * "3 here now" says nothing about who.
 *
 * `connected` is false until the channel is joined and whenever it drops, so
 * callers can fall back to polling.
 */
export function useLiveChannel(
  name: string | null,
  onUpdate: (update: LiveUpdate) => void,
  { presence = false }: { presence?: boolean } = {},
) {
  const [connected, setConnected] = useState(false)
  const [present, setPresent] = useState(0)

  // Latest handler without resubscribing on every render.
  const handler = useRef(onUpdate)
  useEffect(() => { handler.current = onUpdate }, [onUpdate])

  useEffect(() => {
    if (!name) return
    const supabase = createClient()
    let cancelled = false

    const channel = supabase.channel(name, {
      config: {
        private: true,
        ...(presence ? { presence: { key: crypto.randomUUID() } } : {}),
      },
    })

    channel.on('broadcast', { event: LIVE_EVENT }, ({ payload }) => {
      handler.current(payload as LiveUpdate)
    })
    if (presence) {
      channel.on('presence', { event: 'sync' }, () => {
        setPresent(Object.keys(channel.presenceState()).length)
      })
    }

    // Private channels authorise with the current session (or the anon key
    // for guests), so the token must be on the socket before joining.
    supabase.realtime.setAuth().then(() => {
      if (cancelled) return
      channel.subscribe(status => {
        const joined = status === 'SUBSCRIBED'
        setConnected(joined)
        if (joined && presence) channel.track({}).catch(() => {})
      })
    })

    return () => {
      cancelled = true
      supabase.removeChannel(channel)
      setConnected(false)
      setPresent(0)
    }
  }, [name, presence])

  return { connected, present }
}
