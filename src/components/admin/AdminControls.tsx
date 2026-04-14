'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CATEGORY_LABELS, OUTCOME_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils/cn'
import type { Cycle, OutcomeTag } from '@/types'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** Returns the 2nd Friday of a given month/year as a datetime-local string at 11:00 AM IST (05:30 UTC) */
function getSecondFriday(month: number, year: number): string {
  const d = new Date(year, month - 1, 1)
  const dayOfWeek = d.getDay() // 0=Sun, 5=Fri
  const daysToFriday = (5 - dayOfWeek + 7) % 7
  d.setDate(1 + daysToFriday + 7) // 2nd Friday
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}T11:00` // 11 AM IST default
}

/** Convert datetime-local value to ISO string in IST (UTC+5:30) */
function datetimeLocalToISO(dtLocal: string): string {
  if (!dtLocal) return ''
  // dtLocal is "YYYY-MM-DDTHH:mm" — treat as IST
  return new Date(dtLocal + ':00+05:30').toISOString()
}

/** Convert ISO string to datetime-local string in IST for the input */
function isoToDatetimeLocal(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  // Convert to IST (UTC+5:30)
  const ist = new Date(d.getTime() + 5.5 * 60 * 60 * 1000)
  const yyyy = ist.getUTCFullYear()
  const mm = String(ist.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(ist.getUTCDate()).padStart(2, '0')
  const hh = String(ist.getUTCHours()).padStart(2, '0')
  const min = String(ist.getUTCMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`
}

/** Next month/year relative to today */
function nextMonth(): { month: number; year: number } {
  const now = new Date()
  const m = now.getMonth() + 2 // +1 to get next month (1-indexed)
  const y = now.getFullYear()
  return m > 12 ? { month: 1, year: y + 1 } : { month: m, year: y }
}

const OUTCOME_COLORS: Record<OutcomeTag, string> = {
  discussed: 'border-indigo-jp/40 bg-indigo-light text-indigo-jp',
  blog_born: 'border-matcha/40 bg-matcha-light text-matcha',
  project_started: 'border-saffron/40 bg-saffron-light text-saffron',
  carry_forward: 'border-wisteria/40 bg-wisteria-light text-wisteria',
  dropped: 'border-border bg-kinu text-cha',
}

interface AdminControlsProps {
  cycles: Cycle[]
  activeCycle: Cycle | null
  topics: any[]
}

export function AdminControls({ cycles, activeCycle, topics }: AdminControlsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [localTopics, setLocalTopics] = useState<any[]>(topics)

  useEffect(() => {
    setLocalTopics(topics)
  }, [topics])

  // New cycle form
  const [showNewCycle, setShowNewCycle] = useState(false)
  const suggested = nextMonth()
  const [newCycleMonth, setNewCycleMonth] = useState(suggested.month)
  const [newCycleYear, setNewCycleYear] = useState(suggested.year)
  const [meetingDate, setMeetingDate] = useState(getSecondFriday(suggested.month, suggested.year))

  const [activeMeetingDate, setActiveMeetingDate] = useState('')

  useEffect(() => {
    if (!activeCycle?.meeting_at) {
      setActiveMeetingDate('')
      return
    }
    setActiveMeetingDate(isoToDatetimeLocal(activeCycle.meeting_at))
  }, [activeCycle?.meeting_at])

  const doAction = async (
    key: string,
    fn: () => Promise<Response>,
    options?: { refresh?: boolean; onSuccess?: (data: any) => void }
  ) => {
    setError('')
    setLoading(key)
    try {
      const res = await fn()
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Request failed'); return }
      options?.onSuccess?.(data)
      if (options?.refresh !== false) router.refresh()
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(null)
    }
  }

  const updateCycleDate = (cycleId: string) =>
    doAction(`date-${cycleId}`, () =>
      fetch('/api/admin/cycles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycle_id: cycleId, meeting_at: activeMeetingDate ? datetimeLocalToISO(activeMeetingDate) : null }),
      })
    )

  const deleteCycle = (cycleId: string) =>
    doAction(`delete-${cycleId}`, () =>
      fetch('/api/admin/cycles', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycle_id: cycleId }),
      })
    )

  const selectTopic = (topicId: string, isSelected: boolean) =>
    doAction(`select-${topicId}`, () =>
      fetch('/api/admin/select-topic', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_id: topicId, is_selected: isSelected }),
      })
    , {
      refresh: false,
      onSuccess: () => {
        setLocalTopics(prev => prev.map(t => t.id === topicId ? { ...t, is_selected: isSelected } : t))
      },
    })

  const createCycle = () =>
    doAction('create-cycle', () => {
      const label = `${MONTHS[newCycleMonth - 1]} ${newCycleYear}`
      const body: Record<string, any> = { label, month: newCycleMonth, year: newCycleYear }
      // Send date string; API will convert to start-of-day UTC
      if (meetingDate) body.meeting_at = datetimeLocalToISO(meetingDate)
      return fetch('/api/admin/cycles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    })

  const isLoading = (key: string) => loading === key
  const anyLoading = !!loading

  return (
    <div className="space-y-8">
      {/* Error */}
      {error && (
        <div className="px-4 py-3 bg-vermillion-light border border-vermillion/20 rounded-lg text-sm text-vermillion">
          {error}
        </div>
      )}

      {/* ─── Create new cycle ─── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[11px] font-semibold text-cha uppercase tracking-wider">Create Cycle</h2>
          <button
            onClick={() => setShowNewCycle(!showNewCycle)}
            className="text-[13px] text-saffron hover:text-saffron/80 transition-colors"
          >
            {showNewCycle ? 'Cancel' : '+ New cycle'}
          </button>
        </div>

        {showNewCycle && (
          <div className="p-5 bg-paper border border-border rounded-xl space-y-4">
            {/* Suggest next month button */}
            <div className="flex items-center justify-between">
              <p className="text-[12px] text-cha">Pre-fill with suggested next cycle</p>
              <button
                type="button"
                onClick={() => {
                  const s = nextMonth()
                  setNewCycleMonth(s.month)
                  setNewCycleYear(s.year)
                  setMeetingDate(getSecondFriday(s.month, s.year))
                }}
                className="text-[12px] text-saffron hover:text-saffron/80 transition-colors"
              >
                ✦ Suggest {MONTHS[nextMonth().month - 1]} {nextMonth().year}
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-[11px] font-medium text-cha uppercase tracking-wider mb-1.5">Month</label>
                <select
                  value={newCycleMonth}
                  onChange={e => {
                    const m = Number(e.target.value)
                    setNewCycleMonth(m)
                    setMeetingDate(getSecondFriday(m, newCycleYear))
                  }}
                  className="w-full px-3 py-2 bg-sumi border border-border-strong rounded-lg text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-saffron/30 focus:border-saffron/50"
                >
                  {MONTHS.map((m, i) => (
                    <option key={m} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-cha uppercase tracking-wider mb-1.5">Year</label>
                <input
                  type="number"
                  value={newCycleYear}
                  onChange={e => {
                    const y = Number(e.target.value)
                    setNewCycleYear(y)
                    setMeetingDate(getSecondFriday(newCycleMonth, y))
                  }}
                  min={2024}
                  max={2030}
                  className="w-full px-3 py-2 bg-sumi border border-border-strong rounded-lg text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-saffron/30 focus:border-saffron/50"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-cha uppercase tracking-wider mb-1">
                Meeting date & time <span className="normal-case font-normal">(2nd Friday, 11 AM IST auto-filled)</span>
              </label>
              <input
                type="datetime-local"
                value={meetingDate}
                onChange={e => setMeetingDate(e.target.value)}
                className="w-full px-3 py-2 bg-sumi border border-border-strong rounded-lg text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-saffron/30 focus:border-saffron/50"
              />
              {meetingDate && (
                <p className="text-[11px] text-cha mt-1">
                  {new Date(datetimeLocalToISO(meetingDate)).toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}
                </p>
              )}
            </div>
            <button
              onClick={createCycle}
              disabled={isLoading('create-cycle')}
              className="px-4 py-2 bg-saffron text-parchment text-[13px] font-semibold rounded-lg hover:bg-saffron/90 disabled:opacity-40 transition-all"
            >
              {isLoading('create-cycle') ? 'Creating…' : `Create ${MONTHS[newCycleMonth - 1]} ${newCycleYear}`}
            </button>
          </div>
        )}
      </section>

      {/* ─── Active cycle controls ─── */}
      {activeCycle && (
        <section>
          <h2 className="text-[11px] font-semibold text-cha uppercase tracking-wider mb-4">
            Active Cycle — {activeCycle.label}
          </h2>

          {/* Cycle controls */}
          <div className="p-5 bg-paper border border-border rounded-xl mb-4 space-y-3">
            <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
              <div>
                <label className="block text-[11px] font-medium text-cha uppercase tracking-wider mb-1">Meeting date & time</label>
                <input
                  type="datetime-local"
                  value={activeMeetingDate}
                  onChange={e => setActiveMeetingDate(e.target.value)}
                  className="w-full max-w-xs px-3 py-2 bg-sumi border border-border-strong rounded-lg text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-saffron/30 focus:border-saffron/50"
                />
              </div>
              <button
                onClick={() => updateCycleDate(activeCycle.id)}
                disabled={anyLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-saffron/15 border border-saffron/40 text-saffron text-[13px] font-medium rounded-lg hover:bg-saffron/25 disabled:opacity-40 transition-all"
              >
                {isLoading(`date-${activeCycle.id}`) ? 'Saving…' : 'Update date'}
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => deleteCycle(activeCycle.id)}
                disabled={anyLoading}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-vermillion-light border border-vermillion/30 text-vermillion text-[13px] font-medium rounded-lg hover:bg-vermillion/20 disabled:opacity-40 transition-all"
              >
                {isLoading(`delete-${activeCycle.id}`) ? 'Deleting…' : 'Delete cycle'}
              </button>
            </div>
          </div>

          {/* Topic rows */}
          <div className="space-y-2.5">
            {localTopics.length === 0 && (
              <p className="text-[13px] text-cha italic px-1">No topics submitted yet.</p>
            )}
            {localTopics.map((topic: any) => (
              <div
                key={topic.id}
                className={cn(
                  'p-4 bg-paper rounded-xl border transition-colors',
                  topic.is_selected ? 'border-saffron/25 bg-saffron-light/30' : 'border-border',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-medium text-cha">{CATEGORY_LABELS[topic.category]}</span>
                      <span className="text-border-strong">·</span>
                      <span className="text-[11px] text-cha">@{topic.users?.username ?? 'unknown'}</span>
                      {topic.is_selected && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-saffron-light text-saffron border border-saffron/20">
                          ★ Selected
                        </span>
                      )}
                      {topic.outcome_tag && (
                        <span className={cn(
                          'text-[10px] font-medium px-1.5 py-0.5 rounded-full border',
                          OUTCOME_COLORS[topic.outcome_tag as OutcomeTag] ?? 'border-border text-cha bg-kinu'
                        )}>
                          {OUTCOME_LABELS[topic.outcome_tag]}
                        </span>
                      )}
                    </div>
                    <p className="text-[14px] font-medium text-ink">{topic.title}</p>
                    <p className="text-[12px] text-ink-soft mt-0.5 line-clamp-1">{topic.description}</p>
                  </div>
                  <div className="shrink-0 text-right min-w-14">
                    <p className="text-[15px] font-bold text-ink tabular-nums">{topic.score.toFixed(1)}</p>
                    <p className="text-[11px] text-cha tabular-nums">▲{topic.vote_count} · 🤝{topic.contrib_count}</p>
                  </div>
                </div>

                {/* Row actions */}
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border/60">
                  <button
                    onClick={() => selectTopic(topic.id, !topic.is_selected)}
                    disabled={anyLoading}
                    className={cn(
                      'px-3 py-1.5 text-[12px] font-medium rounded-lg border transition-all disabled:opacity-40',
                      topic.is_selected
                        ? 'bg-kinu border-border text-ink-soft hover:text-ink hover:border-border-strong'
                        : 'bg-saffron-light border-saffron/30 text-saffron hover:bg-saffron/20',
                    )}
                  >
                    {isLoading(`select-${topic.id}`) ? '…' : topic.is_selected ? 'Deselect' : '⭐ Select'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  )
}
