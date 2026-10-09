'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from '@phosphor-icons/react/dist/ssr'
import { CATEGORY_LABELS, OUTCOME_LABELS, MAX_SELECTED_TOPICS } from '@/lib/constants'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'
import type { Cycle, OutcomeTag } from '@/types'
import type { CycleTheme } from '@/lib/themes'
import { ThemeEditor, isThemeComplete } from '@/components/admin/ThemeEditor'
import { defaultMeetingAt } from '@/lib/cycles/dates'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** The default meeting (2nd Friday, 11:00 IST) as a datetime-local value. */
function getSecondFriday(month: number, year: number): string {
  return isoToDatetimeLocal(defaultMeetingAt(year, month).toISOString())
}

/** Convert datetime-local value to ISO string in IST (UTC+5:30) */
function datetimeLocalToISO(dtLocal: string): string {
  if (!dtLocal) return ''
  // dtLocal is "YYYY-MM-DDTHH:mm" - treat as IST
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

type BadgeTone = React.ComponentProps<typeof Badge>['tone']

const OUTCOME_TONES: Record<OutcomeTag, BadgeTone> = {
  discussed: 'indigo',
  blog_born: 'matcha',
  project_started: 'saffron',
  carry_forward: 'wisteria',
  dropped: 'neutral',
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
  const [newTheme, setNewTheme] = useState<CycleTheme | null>(null)

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
      setError('Network error - please try again')
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

  const setCycleStatus = (cycleId: string, status: 'open' | 'closed') => {
    const ask = status === 'closed'
      ? 'Close this cycle? The board locks, sparks stay open for 48 hours, and everyone gets a push. Autopilot opens next month the next morning.'
      : 'Reopen this cycle? Everyone gets the month-open message again.'
    if (!confirm(ask)) return
    return doAction(`status-${cycleId}`, () =>
      fetch('/api/admin/cycle-control', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycle_id: cycleId, status }),
      })
    )
  }

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

  /** Hide a topic from the board. Works on ghost topics without revealing
   *  who wrote them: the admin never learns the author, only that it is gone. */
  const hideTopic = (topicId: string, title: string) => {
    if (!window.confirm(`Hide "${title}" from the board? The author can't undo this.`)) return
    return doAction(`hide-${topicId}`, () =>
      fetch('/api/topics', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: topicId }),
      })
    , {
      refresh: false,
      onSuccess: () => setLocalTopics(prev => prev.filter(t => t.id !== topicId)),
    })
  }

  const createCycle = () =>
    doAction('create-cycle', () => {
      const label = `${MONTHS[newCycleMonth - 1]} ${newCycleYear}`
      const body: Record<string, any> = { label, month: newCycleMonth, year: newCycleYear }
      if (newTheme) body.theme = newTheme
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
        <div className="px-(--pad-card) py-3 bg-vermillion/10 rounded-(--radius-card) text-footnote text-vermillion">
          {error}
        </div>
      )}

      {/* ─── Create new cycle ─── */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[11px] font-semibold text-cha uppercase tracking-wider">Create Cycle</h2>
          <Button
            size="sm"
            variant={showNewCycle ? 'ghost' : 'tinted'}
            icon={showNewCycle ? undefined : Plus}
            onClick={() => setShowNewCycle(!showNewCycle)}
          >
            {showNewCycle ? 'Cancel' : 'New cycle'}
          </Button>
        </div>

        {showNewCycle && (
          <div className="p-(--pad-card) bg-paper border border-border rounded-(--radius-card) space-y-4">
            {/* Suggest next month button */}
            <div className="flex items-center justify-between">
              <p className="text-[12px] text-cha">Pre-fill with suggested next cycle</p>
              <Button
                size="sm"
                variant="ghost"
                className="text-saffron hover:text-saffron"
                onClick={() => {
                  const s = nextMonth()
                  setNewCycleMonth(s.month)
                  setNewCycleYear(s.year)
                  setMeetingDate(getSecondFriday(s.month, s.year))
                }}
              >
                Suggest {MONTHS[nextMonth().month - 1]} {nextMonth().year}
              </Button>
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
                  className="w-full px-3 py-2 bg-sumi border border-border rounded-(--radius-control) text-[13px] text-ink focus:outline-none focus:border-saffron/50"
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
                  className="w-full px-3 py-2 bg-sumi border border-border rounded-(--radius-control) text-[13px] text-ink focus:outline-none focus:border-saffron/50"
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
                className="w-full px-3 py-2 bg-sumi border border-border rounded-(--radius-control) text-[13px] text-ink focus:outline-none focus:border-saffron/50"
              />
              {meetingDate && (
                <p className="text-[11px] text-cha mt-1">
                  {new Date(datetimeLocalToISO(meetingDate)).toLocaleString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}
                </p>
              )}
            </div>
            {/* Picked here, not after: creating the cycle opens it and sends
                the month-open message, which is the theme's first outing. */}
            <div>
              <label className="block text-[11px] font-medium text-cha uppercase tracking-wider mb-2">
                Theme <span className="normal-case font-normal">(optional, sets the board copy and the month-open message)</span>
              </label>
              <ThemeEditor
                monthLabel={`${MONTHS[newCycleMonth - 1]} ${newCycleYear}`}
                value={newTheme}
                onChange={setNewTheme}
              />
            </div>
            <Button onClick={createCycle} disabled={isLoading('create-cycle') || !isThemeComplete(newTheme)}>
              {isLoading('create-cycle') ? 'Creating…' : `Create ${MONTHS[newCycleMonth - 1]} ${newCycleYear}`}
            </Button>
          </div>
        )}
      </section>

      {/* ─── Active cycle controls ─── */}
      {activeCycle && (
        <section>
          <h2 className="text-[11px] font-semibold text-cha uppercase tracking-wider mb-4">
            Active Cycle - {activeCycle.label}
          </h2>

          {/* Cycle controls */}
          <div className="p-(--pad-card) bg-paper border border-border rounded-(--radius-card) mb-4 space-y-3">
            <div className="grid sm:grid-cols-[1fr_auto] gap-3 items-end">
              <div>
                <label className="block text-[11px] font-medium text-cha uppercase tracking-wider mb-1">Meeting date & time</label>
                <input
                  type="datetime-local"
                  value={activeMeetingDate}
                  onChange={e => setActiveMeetingDate(e.target.value)}
                  className="w-full max-w-xs px-3 py-2 bg-sumi border border-border rounded-(--radius-control) text-[13px] text-ink focus:outline-none focus:border-saffron/50"
                />
              </div>
              <Button variant="tinted" onClick={() => updateCycleDate(activeCycle.id)} disabled={anyLoading}>
                {isLoading(`date-${activeCycle.id}`) ? 'Saving…' : 'Update date'}
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={activeCycle.status === 'open' ? 'matcha' : 'neutral'}>
                {activeCycle.status === 'open' ? 'Open' : activeCycle.status === 'closed' ? 'Closed' : activeCycle.status}
              </Badge>
              {activeCycle.status === 'open' && (
                <Button variant="secondary" onClick={() => setCycleStatus(activeCycle.id, 'closed')} disabled={anyLoading}>
                  {isLoading(`status-${activeCycle.id}`) ? 'Closing…' : 'Close cycle'}
                </Button>
              )}
              {/* Only the latest cycle can reopen (the route also limits it to
                  this month or last), so two boards are never open at once. */}
              {activeCycle.status !== 'open' && activeCycle.id === cycles[0]?.id && (
                <Button variant="secondary" onClick={() => setCycleStatus(activeCycle.id, 'open')} disabled={anyLoading}>
                  {isLoading(`status-${activeCycle.id}`) ? 'Reopening…' : 'Reopen cycle'}
                </Button>
              )}
              <Button
                variant="danger"
                onClick={() => deleteCycle(activeCycle.id)}
                disabled={anyLoading}
              >
                {isLoading(`delete-${activeCycle.id}`) ? 'Deleting…' : 'Delete cycle'}
              </Button>
            </div>
          </div>

          {/* Topic rows */}
          <div className="space-y-2.5">
            {(() => {
              const selectedCount = localTopics.filter((t: any) => t.is_selected).length
              return (
                <div className="flex items-center justify-between px-1 mb-1">
                  <p className="text-[12px] text-cha">
                    {selectedCount}/{MAX_SELECTED_TOPICS} topics selected
                  </p>
                  {selectedCount >= MAX_SELECTED_TOPICS && (
                    <span className="text-[11px] font-medium text-saffron">Selection limit reached</span>
                  )}
                </div>
              )
            })()}
            {localTopics.length === 0 && (
              <p className="text-[13px] text-cha italic px-1">No topics submitted yet.</p>
            )}
            {localTopics.map((topic: any) => (
              <div
                key={topic.id}
                className={cn(
                  'p-(--pad-card) bg-paper rounded-(--radius-card) border transition-colors',
                  topic.is_selected ? 'border-saffron/25 bg-saffron-light/30' : 'border-border',
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-footnote font-semibold text-ink">{topic.title}</p>
                    <p className="text-[12px] text-ink-soft mt-0.5 line-clamp-1">{topic.description}</p>
                    <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                      <span className="text-[11px] text-cha">{CATEGORY_LABELS[topic.category]}</span>
                      <span className="text-border-strong">·</span>
                      <span className="text-[11px] text-cha">@{topic.author_username ?? 'unknown'}</span>
                      {topic.is_selected && <Badge tone="saffron">Selected</Badge>}
                      {topic.outcome_tag && (
                        <Badge tone={OUTCOME_TONES[topic.outcome_tag as OutcomeTag] ?? 'neutral'}>
                          {OUTCOME_LABELS[topic.outcome_tag]}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-right min-w-14">
                    <p className="text-footnote font-semibold text-ink num">{topic.score.toFixed(1)}</p>
                    <p className="text-[11px] text-cha mt-0.5">
                      <span className="num">{topic.vote_count}</span> votes
                    </p>
                  </div>
                </div>

                {/* Row actions */}
                <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-border/60">
                  <Button
                    size="sm"
                    variant={topic.is_selected ? 'ghost' : 'tinted'}
                    className="-ml-2.5"
                    onClick={() => selectTopic(topic.id, !topic.is_selected)}
                    disabled={anyLoading || (!topic.is_selected && localTopics.filter((t: any) => t.is_selected).length >= MAX_SELECTED_TOPICS)}
                  >
                    {isLoading(`select-${topic.id}`) ? '…' : topic.is_selected ? 'Deselect' : 'Select'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="ml-auto text-ink-muted"
                    onClick={() => hideTopic(topic.id, topic.title)}
                    disabled={anyLoading}
                  >
                    {isLoading(`hide-${topic.id}`) ? '…' : 'Hide'}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  )
}
