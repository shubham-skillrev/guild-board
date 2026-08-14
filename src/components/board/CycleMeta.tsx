'use client'

/**
 * The header furniture: when the meeting is, and what the cycle is currently
 * letting you do.
 *
 * This existed before and was dropped on the argument that MeetingPill carries
 * the meeting date. It does not: MeetingPill only appears inside the final 48
 * hours, so for most of a cycle the board showed no meeting date at all. The
 * two are complements, not duplicates, and they are mutually exclusive by
 * construction here (this hides inside 48h, MeetingPill appears).
 *
 * Both read as metadata rather than as controls. Nothing here is tappable.
 */

import { useEffect, useState } from 'react'
import { CalendarBlank } from '@phosphor-icons/react/dist/ssr'
import { Icon } from '@/components/ui/Icon'
import type { Cycle } from '@/types'

function getSecondFriday(year: number, month: number): Date {
  const firstDay = new Date(year, month - 1, 1)
  const dow = firstDay.getDay()
  return new Date(year, month - 1, 1 + ((5 - dow + 7) % 7) + 7, 5, 30)
}

function getMeetingDate(cycle: Cycle | null | undefined): Date | null {
  if (!cycle) return null
  if (cycle.meeting_at) {
    const d = new Date(cycle.meeting_at)
    if (!Number.isNaN(d.getTime())) return d
  }
  return getSecondFriday(cycle.year, cycle.month)
}

const WITHIN_48H = 48 * 60 * 60 * 1000

/** Date and time, compact: "Fri 11 Sept · 11:00". */
function format(d: Date): string {
  const date = d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  })
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return `${date} · ${time}`
}

/**
 * Shown while the meeting is further out than 48 hours. Inside that window the
 * floating countdown takes over, so exactly one of the two is ever on screen.
 */
export function MeetingDate({ cycle, phase }: { cycle: Cycle | null | undefined; phase: string }) {
  const meeting = getMeetingDate(cycle)

  /* "How far away is the meeting" cannot be answered during render: the server
     and the browser would answer differently and hydration would mismatch. So
     the badge resolves after mount, and the 48h handover to MeetingPill is
     decided on the client where both components agree. */
  const [withinWindow, setWithinWindow] = useState<boolean | null>(null)

  useEffect(() => {
    if (!meeting) return
    const evaluate = () => {
      const remaining = meeting.getTime() - Date.now()
      setWithinWindow(remaining > 0 && remaining > WITHIN_48H)
    }
    evaluate()
    // Minute resolution is enough: this only has to notice a day boundary and
    // the 48h handover, never a second.
    const id = setInterval(evaluate, 60_000)
    return () => clearInterval(id)
  }, [meeting?.getTime()]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!meeting || phase === 'upcoming') return null
  if (withinWindow !== true) return null

  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-paper/60 border border-border text-ink-soft">
      <Icon icon={CalendarBlank} size="sm" className="text-ink-muted" />
      {format(meeting)}
    </span>
  )
}

/**
 * What the cycle currently permits. Matcha while it is open, indigo once it
 * moves to discussion: a state change, not decoration, which is the bar a
 * colour has to clear here.
 */
export function CycleStatus({ phase }: { phase: string }) {
  if (phase === 'upcoming') return null
  const isOpen = phase === 'open'

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${
        isOpen ? 'bg-matcha-light text-matcha' : 'bg-indigo-light text-indigo-jp'
      }`}
    >
      <span
        className={`w-1.5 h-1.5 rounded-full ${
          isOpen ? 'bg-matcha animate-pulse-soft' : 'bg-indigo-jp'
        }`}
      />
      {isOpen ? 'Open for votes' : 'Discussion mode'}
    </span>
  )
}
