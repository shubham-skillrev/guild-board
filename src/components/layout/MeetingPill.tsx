'use client'

import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Cycle } from '@/types'

/* ── Helpers ── */

function getSecondFriday(year: number, month: number): Date {
  const firstDay = new Date(year, month - 1, 1)
  const dow = firstDay.getDay()
  const dayOfMonth = 1 + ((5 - dow + 7) % 7) + 7
  return new Date(year, month - 1, dayOfMonth, 5, 30) // default 11 AM IST = 05:30 UTC
}

function getMeetingDate(cycle: Cycle | null | undefined): Date | null {
  if (!cycle) return null
  if (cycle.meeting_at) {
    const d = new Date(cycle.meeting_at)
    if (!Number.isNaN(d.getTime())) return d
  }
  return getSecondFriday(cycle.year, cycle.month)
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}

function formatDate(date: Date): string {
  return date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })
}

/* ── Countdown logic ── */

interface Countdown {
  totalMs: number
  hours: number
  minutes: number
  seconds: number
  isToday: boolean
  isPast: boolean
  isWithin48h: boolean
}

function getCountdown(meeting: Date): Countdown {
  const now = Date.now()
  const diff = meeting.getTime() - now
  const isPast = diff <= 0
  const totalMs = Math.max(0, diff)
  const totalSec = Math.floor(totalMs / 1000)
  const hours = Math.floor(totalSec / 3600)
  const minutes = Math.floor((totalSec % 3600) / 60)
  const seconds = totalSec % 60

  const today = new Date()
  const isToday =
    meeting.getFullYear() === today.getFullYear() &&
    meeting.getMonth() === today.getMonth() &&
    meeting.getDate() === today.getDate()

  return { totalMs, hours, minutes, seconds, isToday, isPast, isWithin48h: totalMs <= 48 * 60 * 60 * 1000 }
}

function useMeetingCountdown(cycle: Cycle | null | undefined) {
  const meetingDate = getMeetingDate(cycle)
  const [countdown, setCountdown] = useState<Countdown | null>(null)

  useEffect(() => {
    if (!meetingDate) return
    setCountdown(getCountdown(meetingDate))
    const id = setInterval(() => {
      const c = getCountdown(meetingDate)
      setCountdown(c)
      if (c.isPast) clearInterval(id)
    }, 1000)
    return () => clearInterval(id)
  }, [meetingDate?.getTime()]) // eslint-disable-line react-hooks/exhaustive-deps

  return { meetingDate, countdown }
}

/* ────────────────────────────────────────────────────────
   1. MeetingDateBadge  — inline header chip (> 48 h away)
   ──────────────────────────────────────────────────────── */

interface MeetingBadgeProps {
  cycle: Cycle | null | undefined
  phase: string
}

export function MeetingDateBadge({ cycle, phase }: MeetingBadgeProps) {
  const { meetingDate, countdown } = useMeetingCountdown(cycle)

  if (!meetingDate || !countdown || phase === 'upcoming') return null
  if (countdown.isPast || countdown.isWithin48h) return null

  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full bg-paper/60 border border-border text-ink-soft">
      <span className="text-[10px]">📅</span>
      {formatDate(meetingDate)} · {formatTime(meetingDate)}
    </span>
  )
}

/* ────────────────────────────────────────────────────────
   2. MeetingPill — portalled floating timer (≤ 48 h)
      • bottom-20 mobile (clears the ~64px tab nav)
      • bottom-6 desktop
      • click pill → collapses to dot; click dot → expands
      • portalled to document.body to escape Framer Motion
        scale transform that traps position:fixed children
   ──────────────────────────────────────────────────────── */

interface MeetingPillProps {
  cycle: Cycle | null | undefined
  phase: string
}

export function MeetingPill({ cycle, phase }: MeetingPillProps) {
  const { meetingDate, countdown } = useMeetingCountdown(cycle)
  const [collapsed, setCollapsed] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!mounted || !meetingDate || !countdown || phase === 'upcoming') return null
  if (countdown.isPast || !countdown.isWithin48h) return null

  const isToday = countdown.isToday
  const timerText =
    countdown.hours > 0 || countdown.minutes > 0
      ? `${countdown.hours}h ${String(countdown.minutes).padStart(2, '0')}m ${String(countdown.seconds).padStart(2, '0')}s`
      : 'Starting now'

  /* ── Collapsed: small pulsing dot ── */
  if (collapsed) {
    return createPortal(
      <button
        onClick={() => setCollapsed(false)}
        aria-label="Show meeting countdown"
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-9998 w-9 h-9 rounded-full bg-paper/95 border border-saffron/40 shadow-lg shadow-black/30 backdrop-blur-sm flex items-center justify-center transition-transform hover:scale-110"
      >
        <span className="relative flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-saffron opacity-50" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-saffron" />
        </span>
      </button>,
      document.body
    )
  }

  /* ── Expanded pill — click anywhere to collapse ── */
  return createPortal(
    <button
      onClick={() => setCollapsed(true)}
      aria-label="Collapse meeting countdown"
      className={[
        'fixed bottom-20 right-4 md:bottom-6 md:right-6 z-9998',
        'flex items-center gap-2.5 px-3 py-2 rounded-xl border',
        'shadow-lg backdrop-blur-sm transition-all active:scale-95',
        isToday
          ? 'bg-saffron border-saffron shadow-saffron/20 text-parchment'
          : 'bg-paper/95 border-saffron/30 shadow-black/20',
      ].join(' ')}
    >
      {/* Pulsing dot */}
      <span className="relative flex h-2 w-2 shrink-0">
        <span className={[
          'animate-ping absolute inline-flex h-full w-full rounded-full opacity-50',
          isToday ? 'bg-parchment' : 'bg-saffron',
        ].join(' ')} />
        <span className={[
          'relative inline-flex rounded-full h-2 w-2',
          isToday ? 'bg-parchment' : 'bg-saffron',
        ].join(' ')} />
      </span>

      {/* Label + timer */}
      <div className="flex flex-col items-start leading-none gap-0.75">
        <span className={[
          'text-[9px] font-semibold uppercase tracking-widest',
          isToday ? 'opacity-70' : 'text-cha',
        ].join(' ')}>
          {isToday ? 'Today' : 'Meeting in'}
        </span>
        <span className={[
          'text-[15px] font-bold tabular-nums',
          isToday ? '' : 'text-saffron',
        ].join(' ')}>
          {timerText}
        </span>
      </div>
    </button>,
    document.body
  )
}
