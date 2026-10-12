'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowFatUp, Plus } from '@phosphor-icons/react/dist/ssr'
import { CATEGORY_LABELS, OUTCOME_LABELS, MAX_SELECTED_TOPICS } from '@/lib/constants'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'
import type { Cycle, OutcomeTag } from '@/types'
import type { CycleTheme } from '@/lib/themes'
import { ThemeEditor, isThemeComplete } from '@/components/admin/ThemeEditor'
import { defaultMeetingAt } from '@/lib/cycles/dates'
import { SectionHeader } from '@/components/ui/Section'
import { OverflowMenu } from '@/components/ui/OverflowMenu'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { AuthorMark } from '@/components/topics/AuthorMark'
import { problemBlurb } from '@/lib/experiment'

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

const STATUS_LABELS: Record<string, string> = {
  upcoming: 'Upcoming',
  open: 'Open',
  frozen: 'Frozen',
  closed: 'Closed',
}

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

  // Deleting a cycle also deletes its topics. It used to fire on one click;
  // it now goes through a dialog where the month's name must be typed.
  const [confirmDelete, setConfirmDelete] = useState<Cycle | null>(null)
  const deleteCycle = (cycleId: string) =>
    doAction(`delete-${cycleId}`, () =>
      fetch('/api/admin/cycles', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycle_id: cycleId }),
      })
    , { onSuccess: () => setConfirmDelete(null) })

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

  const field = 'w-full h-9 px-3 bg-sumi border border-border rounded-(--radius-control) text-footnote text-ink focus:outline-none focus:border-saffron/50'
  const fieldLabel = 'block text-footnote text-ink-soft mb-1.5'
  const selectedCount = localTopics.filter((t: any) => t.is_selected).length

  return (
    <div className="space-y-(--gap-section)">
      {error && (
        <div role="alert" className="px-(--pad-card) py-3 bg-vermillion/10 rounded-(--radius-card) text-footnote text-vermillion">
          {error}
        </div>
      )}

      {/* ─── This cycle: meeting date, status, and the way to start the next one ─── */}
      <section>
        <SectionHeader
          title="This cycle"
          hint={activeCycle ? activeCycle.label : 'No cycle yet'}
          action={
            <Button
              size="sm"
              variant={showNewCycle ? 'ghost' : 'secondary'}
              icon={showNewCycle ? undefined : Plus}
              onClick={() => setShowNewCycle(!showNewCycle)}
            >
              {showNewCycle ? 'Cancel' : 'New cycle'}
            </Button>
          }
        />

        {showNewCycle && (
          <div className="mb-4 p-(--pad-card) bg-paper border border-border rounded-(--radius-card) space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-footnote text-ink">New cycle</p>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  const s = nextMonth()
                  setNewCycleMonth(s.month)
                  setNewCycleYear(s.year)
                  setMeetingDate(getSecondFriday(s.month, s.year))
                }}
              >
                Use {MONTHS[nextMonth().month - 1]} {nextMonth().year}
              </Button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label>
                <span className={fieldLabel}>Month</span>
                <select
                  value={newCycleMonth}
                  onChange={e => {
                    const m = Number(e.target.value)
                    setNewCycleMonth(m)
                    setMeetingDate(getSecondFriday(m, newCycleYear))
                  }}
                  className={field}
                >
                  {MONTHS.map((m, i) => (
                    <option key={m} value={i + 1}>{m}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className={fieldLabel}>Year</span>
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
                  className={field}
                />
              </label>
            </div>
            <label className="block">
              <span className={fieldLabel}>Meeting <span className="text-cha">(2nd Friday, 11:00 IST, pre-filled)</span></span>
              <input type="datetime-local" value={meetingDate} onChange={e => setMeetingDate(e.target.value)} className={field} />
              {meetingDate && (
                <span className="block text-caption text-cha mt-1">
                  {new Date(datetimeLocalToISO(meetingDate)).toLocaleString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' })}
                </span>
              )}
            </label>
            {/* Picked here, not after: creating the cycle opens it and sends
                the month-open message, which is the theme's first outing. */}
            <div>
              <p className={fieldLabel}>Theme <span className="text-cha">(optional: board copy and the month-open message)</span></p>
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

        {activeCycle && (
          <div className="p-(--pad-card) bg-paper border border-border rounded-(--radius-card) space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-end gap-2">
              <label className="flex-1 min-w-0 sm:max-w-xs">
                <span className={fieldLabel}>Meeting date and time</span>
                <input
                  type="datetime-local"
                  value={activeMeetingDate}
                  onChange={e => setActiveMeetingDate(e.target.value)}
                  className={field}
                />
              </label>
              <Button variant="secondary" onClick={() => updateCycleDate(activeCycle.id)} disabled={anyLoading} className="self-start sm:self-auto">
                {isLoading(`date-${activeCycle.id}`) ? 'Saving…' : 'Save date'}
              </Button>
            </div>

            <div className="flex items-center gap-2 pt-4 border-t border-border">
              <Badge tone={activeCycle.status === 'open' ? 'matcha' : 'neutral'} dot>
                {STATUS_LABELS[activeCycle.status] ?? activeCycle.status}
              </Badge>
              {activeCycle.status === 'open' && (
                <Button size="sm" variant="secondary" onClick={() => setCycleStatus(activeCycle.id, 'closed')} disabled={anyLoading}>
                  {isLoading(`status-${activeCycle.id}`) ? 'Closing…' : 'Close cycle'}
                </Button>
              )}
              {/* Only the latest cycle can reopen (the route also limits it to
                  this month or last), so two boards are never open at once. */}
              {activeCycle.status !== 'open' && activeCycle.id === cycles[0]?.id && (
                <Button size="sm" variant="secondary" onClick={() => setCycleStatus(activeCycle.id, 'open')} disabled={anyLoading}>
                  {isLoading(`status-${activeCycle.id}`) ? 'Reopening…' : 'Reopen cycle'}
                </Button>
              )}
              <OverflowMenu
                className="ml-auto"
                label={`More actions for ${activeCycle.label}`}
                items={[{ label: `Delete ${activeCycle.label}…`, danger: true, onSelect: () => setConfirmDelete(activeCycle) }]}
              />
            </div>
          </div>
        )}
      </section>

      {/* ─── Topics: one compact row each ─── */}
      {activeCycle && (
        <section>
          <SectionHeader
            title="Topics"
            hint={selectedCount >= MAX_SELECTED_TOPICS
              ? `${selectedCount} of ${MAX_SELECTED_TOPICS} on the agenda. That's the limit.`
              : `${selectedCount} of ${MAX_SELECTED_TOPICS} on the agenda`}
          />
          {localTopics.length === 0 ? (
            <p className="text-footnote text-cha">No topics yet.</p>
          ) : (
            <ul className="bg-paper border border-border rounded-(--radius-card) divide-y divide-border overflow-hidden">
              {localTopics.map((topic: any) => (
                <li
                  key={topic.id}
                  className={cn('flex items-start gap-3 px-(--pad-card) py-3', topic.is_selected && 'bg-saffron/6')}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-footnote text-ink line-clamp-2 sm:line-clamp-1">{topic.title}</p>
                    <p className="text-caption text-cha mt-0.5 line-clamp-1">{problemBlurb(topic.description)}</p>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-1.5 text-caption text-cha">
                      <span>{CATEGORY_LABELS[topic.category]}</span>
                      <span aria-hidden>·</span>
                      <AuthorMark username={topic.author_username} isSystem={topic.is_system} size={14} className="text-caption" />
                      <span aria-hidden>·</span>
                      <span className="inline-flex items-center gap-1" title="Votes">
                        <ArrowFatUp className="w-3 h-3" />
                        <span className="num">{topic.vote_count}</span>
                      </span>
                      {topic.outcome_tag && (
                        <Badge tone={OUTCOME_TONES[topic.outcome_tag as OutcomeTag] ?? 'neutral'}>
                          {OUTCOME_LABELS[topic.outcome_tag]}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center gap-1">
                    <Button
                      size="sm"
                      variant={topic.is_selected ? 'secondary' : 'tinted'}
                      onClick={() => selectTopic(topic.id, !topic.is_selected)}
                      disabled={anyLoading || (!topic.is_selected && selectedCount >= MAX_SELECTED_TOPICS)}
                    >
                      {isLoading(`select-${topic.id}`) ? '…' : topic.is_selected ? 'Selected' : 'Select'}
                    </Button>
                    <OverflowMenu
                      label={`More actions for ${topic.title}`}
                      items={[
                        ...(topic.is_selected ? [{ label: 'Remove from agenda', onSelect: () => selectTopic(topic.id, false) }] : []),
                        { label: 'Hide from the board…', danger: true, onSelect: () => hideTopic(topic.id, topic.title) },
                      ]}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {confirmDelete && (
        <ConfirmDialog
          title={`Delete ${confirmDelete.label}?`}
          body="This deletes the cycle and every topic, vote and comment in it. It cannot be undone."
          confirmText={confirmDelete.label}
          actionLabel="Delete cycle"
          pending={isLoading(`delete-${confirmDelete.id}`)}
          onConfirm={() => deleteCycle(confirmDelete.id)}
          onClose={() => setConfirmDelete(null)}
        />
      )}
    </div>
  )
}
