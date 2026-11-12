'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight } from '@phosphor-icons/react/dist/ssr'
import { Icon } from '@/components/ui/Icon'

const POLL_MS = 60_000

/**
 * "Meeting is live, join the room": across the site while this month's
 * meeting is in meeting mode (docs/06-meeting-mode.md). It's how people
 * join: no link in the call chat, no QR code. Opens /meet.
 *
 * Asks GET /api/meet/live on load, once a minute while the tab is visible,
 * and whenever the tab comes back. Neutral, with a small live dot: the
 * page's own saffron action stays the only accent.
 */
export function MeetingLiveBanner() {
  const [live, setLive] = useState(false)

  useEffect(() => {
    let alive = true
    const check = () => {
      if (document.hidden) return
      fetch('/api/meet/live', { cache: 'no-store' })
        .then(r => (r.ok ? r.json() : null))
        .then(d => { if (alive && d) setLive(!!d.live) })
        .catch(() => {})
    }
    check()
    const id = setInterval(check, POLL_MS)
    document.addEventListener('visibilitychange', check)
    return () => {
      alive = false
      clearInterval(id)
      document.removeEventListener('visibilitychange', check)
    }
  }, [])

  if (!live) return null
  return <MeetingLiveBannerView />
}

/** The banner itself (the dev mock, /meet/mock, shows it without asking the server). */
export function MeetingLiveBannerView() {
  return (
    <div className="border-b border-border bg-paper print:hidden">
      <Link
        href="/meet"
        className="press mx-auto flex h-10 w-full max-w-7xl items-center gap-2.5 px-5 text-footnote text-ink-soft hover:text-ink md:px-10"
      >
        <span aria-hidden className="relative flex size-2 shrink-0">
          <span className="absolute inset-0 rounded-full bg-vermillion opacity-60 motion-safe:animate-ping" />
          <span className="relative size-2 rounded-full bg-vermillion" />
        </span>
        <span>
          <span className="font-medium text-ink">Meeting is live,</span> join the room
        </span>
        <Icon icon={ArrowRight} size="sm" className="ml-auto" />
      </Link>
    </div>
  )
}
