'use client'

import { useEffect, useState } from 'react'
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

/* ── Component ── */

interface MeetingPillProps {
  cycle: Cycle | null | undefined
  phase: string
}

export function MeetingPill({ cycle, phase }: MeetingPillProps) {
  const meetingDate = getMeetingDate(cycle)
  const [countdown, setCountdown] = useState<Countdown | null>(null)

  useEffect(() => {
    if (!meetingDate) return
    // Initial computation
    setCountdown(getCountdown(meetingDate))

    // Tick every second when within 48h, otherwise every 60s
    const id = setInterval(() => {
      const c = getCountdown(meetingDate)
      setCountdown(c)
      if (c.isPast) clearInterval(id)
    }, 1000)

    return () => clearInterval(id)
  }, [meetingDate?.getTime()]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!meetingDate || !countdown || phase === 'upcoming') return null
  if (countdown.isPast) return null

  // ── Meeting today ──
  if (countdown.isToday) {
    return (
      <div className="fixed bottom-20 md:bottom-14 inset-x-4 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 z-40 animate-fade-up">
        <div className="flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-full bg-saffron/95 text-parchment shadow-lg shadow-saffron/20 backdrop-blur-sm w-full md:w-auto">
          <span className="w-2 h-2 rounded-full bg-parchment animate-pulse-soft" />
          <span className="text-[13px] font-semibold">
            Meeting today at {formatTime(meetingDate)}
          </span>
          {countdown.hours > 0 || countdown.minutes > 0 ? (
            <span className="hidden sm:inline text-[12px] font-medium opacity-80">
              · {countdown.hours > 0 ? `${countdown.hours}h ` : ''}{String(countdown.minutes).padStart(2, '0')}m
            </span>
          ) : (
            <span className="text-[12px] font-medium opacity-80">· starting now</span>
          )}
        </div>
      </div>
    )
  }

  // ── Live countdown (within 48h) ──
  if (countdown.isWithin48h) {
    return (
      <div className="fixed bottom-20 md:bottom-14 inset-x-4 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 z-40 animate-fade-up">
        <div className="flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-full bg-paper/95 border border-saffron/30 text-ink shadow-lg shadow-black/20 backdrop-blur-sm w-full md:w-auto">
          <span className="w-2 h-2 rounded-full bg-saffron animate-pulse-soft" />
          <span className="text-[13px] font-medium">
            Meeting in{' '}
            <span className="text-saffron font-semibold tabular-nums">
              {countdown.hours}h {String(countdown.minutes).padStart(2, '0')}m {String(countdown.seconds).padStart(2, '0')}s
            </span>
          </span>
          <span className="hidden sm:inline text-[11px] text-cha">
            {formatDate(meetingDate)} · {formatTime(meetingDate)}
          </span>
        </div>
      </div>
    )
  }

  // ── Subtle date pill (> 48h away) ──
  return (
    <div className="fixed bottom-20 md:bottom-14 inset-x-4 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 z-40 animate-fade-up">
      <div className="flex items-center justify-center gap-2 px-3.5 py-2 rounded-full bg-paper/90 border border-border text-ink-soft shadow-lg shadow-black/15 backdrop-blur-sm w-full md:w-auto">
        <span className="text-[12px]">📅</span>
        <span className="text-[12px] font-medium">
          Meeting · {formatDate(meetingDate)} · {formatTime(meetingDate)}
        </span>
      </div>
    </div>
  )
}
