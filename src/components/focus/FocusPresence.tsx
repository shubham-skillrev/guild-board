'use client'

import { useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { PLANS, useFocusState } from '@/lib/focus/store'
import { FOCUS_CHANNEL, browserKey, setRoom, type Lit, type Person, type WindowState } from '@/lib/focus/presence'

/**
 * You, in the focus room's count: there while your focus timer runs, on any
 * page, gone when it stops or pauses. Members only. Mounted once in the
 * layout; joins the channel while your timer runs or while you're on /focus
 * (to see the others), and leaves otherwise.
 */
export function FocusPresence({ member }: { member: boolean }) {
  const state = useFocusState()
  const onFocusPage = usePathname() === '/focus'
  const running = state.phase !== 'idle' && state.endsAt !== null
  const join = member && (running || onFocusPage)
  const channelRef = useRef<RealtimeChannel | null>(null)
  const joined = useRef(false)

  // What you share: focusing or on a break, and since when.
  const litKey = running && state.endsAt
    ? `${state.phase === 'break' ? 'break' : 'focus'}:${round(state.endsAt - (state.phase === 'break' ? PLANS[state.plan].rest : PLANS[state.plan].focus) * 60_000)}`
    : null

  useEffect(() => { setRoom({ member }) }, [member])

  useEffect(() => {
    if (!join) return
    const { key } = browserKey()
    const supabase = createClient()
    let cancelled = false
    const channel = supabase.channel(FOCUS_CHANNEL, { config: { private: true, presence: { key } } })
    channelRef.current = channel

    channel.on('presence', { event: 'sync' }, () => {
      const people: Person[] = []
      for (const [k, metas] of Object.entries(channel.presenceState<Lit>())) {
        const m = metas[0]
        if (m && (m.s === 'focus' || m.s === 'break')) people.push({ key: k, s: m.s, since: Number(m.since) || 0, look: Number(m.look) || 0, you: k === key })
      }
      setRoom({ people })
    })

    supabase.realtime.setAuth().then(() => {
      if (cancelled) return
      channel.subscribe(status => {
        joined.current = status === 'SUBSCRIBED'
        setRoom({ connected: joined.current })
        if (joined.current) window.dispatchEvent(new Event('gb:focus-joined'))
      })
    })

    return () => {
      cancelled = true
      joined.current = false
      channelRef.current = null
      supabase.removeChannel(channel)
      setRoom({ connected: false, people: [] })
    }
  }, [join])

  // Join or leave the count as the timer changes (and once joined).
  useEffect(() => {
    if (!join) return
    const send = () => {
      const channel = channelRef.current
      if (!channel || !joined.current) return
      const { look } = browserKey()
      if (litKey) {
        const [s, since] = litKey.split(':')
        channel.track({ s: s as WindowState, since: Number(since), look } satisfies Lit).catch(() => {})
      } else {
        channel.untrack().catch(() => {})
      }
    }
    send()
    window.addEventListener('gb:focus-joined', send)
    return () => window.removeEventListener('gb:focus-joined', send)
  }, [join, litKey])

  return null
}

/** To the nearest ten seconds: enough for break parties, no finer. */
const round = (ms: number) => Math.round(ms / 10_000) * 10_000
