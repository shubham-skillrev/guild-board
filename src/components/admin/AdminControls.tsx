'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CATEGORY_LABELS, OUTCOME_LABELS } from '@/lib/constants'
import { cn } from '@/lib/utils/cn'
import type { Cycle, CycleStatus, OutcomeTag } from '@/types'

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

/** Returns the ISO date string (YYYY-MM-DD) of the first Friday of a given month/year */
function getFirstFriday(month: number, year: number): string {
  const d = new Date(year, month - 1, 1)
  const dayOfWeek = d.getDay() // 0=Sun, 5=Fri
  const daysToFriday = (5 - dayOfWeek + 7) % 7
  d.setDate(1 + daysToFriday)
  return d.toISOString().split('T')[0]
}

/** Next month/year relative to today */
function nextMonth(): { month: number; year: number } {
  const now = new Date()
  const m = now.getMonth() + 2 // +1 to get next month (1-indexed)
  const y = now.getFullYear()
  return m > 12 ? { month: 1, year: y + 1 } : { month: m, year: y }
}

const VALID_OUTCOMES: OutcomeTag[] = ['discussed', 'blog_born', 'project_started', 'carry_forward', 'dropped']

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

  // New cycle form
  const [showNewCycle, setShowNewCycle] = useState(false)
  const suggested = nextMonth()
  const [newCycleMonth, setNewCycleMonth] = useState(suggested.month)
  const [newCycleYear, setNewCycleYear] = useState(suggested.year)
  const [meetingDate, setMeetingDate] = useState(getFirstFriday(suggested.month, suggested.year))

  // Outcome form
  const [editingOutcome, setEditingOutcome] = useState<string | null>(null)
  const [outcomeTag, setOutcomeTag] = useState<OutcomeTag>('discussed')
  const [outcomeNote, setOutcomeNote] = useState('')

  // Close confirmation modal
  const [confirmClose, setConfirmClose] = useState<{ cycleId: string; label: string } | null>(null)

  const doAction = async (key: string, fn: () => Promise<Response>) => {
    setError('')
    setLoading(key)
    try {
      const res = await fn()
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Request failed'); return }
      router.refresh()
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(null)
    }
  }

  const setCycleStatus = (cycleId: string, status: CycleStatus) =>
    doAction(`status-${cycleId}-${status}`, () =>
      fetch('/api/admin/cycle-control', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycle_id: cycleId, status }),
      })
    )

  const handleCloseClick = (cycle: Cycle) => {
    setConfirmClose({ cycleId: cycle.id, label: cycle.label })
  }

  const confirmCloseAction = () => {
    if (!confirmClose) return
    setConfirmClose(null)
    setCycleStatus(confirmClose.cycleId, 'closed')
  }

  const selectTopic = (topicId: string, isSelected: boolean) =>
    doAction(`select-${topicId}`, () =>
      fetch('/api/admin/select-topic', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_id: topicId, is_selected: isSelected }),
      })
    )

  const saveOutcome = (topicId: string) =>
    doAction(`outcome-${topicId}`, async () => {
      const res = await fetch('/api/admin/outcome', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_id: topicId, outcome_tag: outcomeTag, outcome_note: outcomeNote }),
      })
      setEditingOutcome(null)
      return res
    })

  const createCycle = () =>
    doAction('create-cycle', () => {
      const label = `${MONTHS[newCycleMonth - 1]} ${newCycleYear}`
      const body: Record<string, any> = { label, month: newCycleMonth, year: newCycleYear }
      // Send date string; API will convert to start-of-day UTC
      if (meetingDate) body.meeting_at = meetingDate
      return fetch('/api/admin/cycles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    })

  const triggerCarryForward = (cycleId: string) =>
    doAction(`carry-${cycleId}`, () =>
      fetch('/api/admin/carry-forward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycle_id: cycleId }),
      })
    )

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
                  setMeetingDate(getFirstFriday(s.month, s.year))
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
                    setMeetingDate(getFirstFriday(m, newCycleYear))
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
                    setMeetingDate(getFirstFriday(newCycleMonth, y))
                  }}
                  min={2024}
                  max={2030}
                  className="w-full px-3 py-2 bg-sumi border border-border-strong rounded-lg text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-saffron/30 focus:border-saffron/50"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-cha uppercase tracking-wider mb-1">
                Meeting date <span className="normal-case font-normal">(first Friday auto-filled)</span>
              </label>
              <input
                type="date"
                value={meetingDate}
                onChange={e => setMeetingDate(e.target.value)}
                className="w-full px-3 py-2 bg-sumi border border-border-strong rounded-lg text-[13px] text-ink focus:outline-none focus:ring-2 focus:ring-saffron/30 focus:border-saffron/50"
              />
              {meetingDate && (
                <p className="text-[11px] text-cha mt-1">
                  {new Date(meetingDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
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

          {/* Status card */}
          <div className="p-5 bg-paper border border-border rounded-xl mb-4 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-cha">Current status:</span>
              <span className={cn(
                'text-[11px] font-semibold px-2.5 py-0.5 rounded-full',
                activeCycle.status === 'open' && 'bg-matcha-light text-matcha',
                activeCycle.status === 'frozen' && 'bg-indigo-light text-indigo-jp',
                activeCycle.status === 'closed' && 'bg-kinu text-cha',
                activeCycle.status === 'upcoming' && 'bg-saffron-light text-saffron',
              )}>
                {activeCycle.status}
              </span>
            </div>

            <div className="flex flex-wrap gap-2">
              {/* upcoming → open */}
              {activeCycle.status === 'upcoming' && (
                <button
                  onClick={() => setCycleStatus(activeCycle.id, 'open')}
                  disabled={anyLoading}
                  className="inline-flex items-center gap-1.5 px-4 py-2 bg-matcha/15 border border-matcha/40 text-matcha text-[13px] font-medium rounded-lg hover:bg-matcha/25 disabled:opacity-40 transition-all"
                >
                  {anyLoading ? '…' : '▶ Open cycle'}
                </button>
              )}

              {/* open → freeze / close */}
              {activeCycle.status === 'open' && (
                <>
                  <button
                    onClick={() => setCycleStatus(activeCycle.id, 'frozen')}
                    disabled={anyLoading}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-light border border-indigo-jp/30 text-indigo-jp text-[13px] font-medium rounded-lg hover:bg-indigo-jp/20 disabled:opacity-40 transition-all"
                  >
                    {anyLoading ? '…' : '❄ Freeze cycle'}
                  </button>
                  <button
                    onClick={() => handleCloseClick(activeCycle)}
                    disabled={anyLoading}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-vermillion-light border border-vermillion/30 text-vermillion text-[13px] font-medium rounded-lg hover:bg-vermillion/20 disabled:opacity-40 transition-all"
                  >
                    🔒 Close cycle
                  </button>
                </>
              )}

              {/* frozen → reopen / close */}
              {activeCycle.status === 'frozen' && (
                <>
                  <button
                    onClick={() => setCycleStatus(activeCycle.id, 'open')}
                    disabled={anyLoading}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-matcha/15 border border-matcha/40 text-matcha text-[13px] font-medium rounded-lg hover:bg-matcha/25 disabled:opacity-40 transition-all"
                  >
                    {anyLoading ? '…' : '↩ Reopen cycle'}
                  </button>
                  <button
                    onClick={() => handleCloseClick(activeCycle)}
                    disabled={anyLoading}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-vermillion-light border border-vermillion/30 text-vermillion text-[13px] font-medium rounded-lg hover:bg-vermillion/20 disabled:opacity-40 transition-all"
                  >
                    🔒 Close cycle
                  </button>
                </>
              )}

              {/* closed → reopen / carry-forward */}
              {activeCycle.status === 'closed' && (
                <>
                  <button
                    onClick={() => setCycleStatus(activeCycle.id, 'open')}
                    disabled={anyLoading}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-matcha/15 border border-matcha/40 text-matcha text-[13px] font-medium rounded-lg hover:bg-matcha/25 disabled:opacity-40 transition-all"
                  >
                    {anyLoading ? '…' : '↩ Reopen cycle'}
                  </button>
                  <button
                    onClick={() => triggerCarryForward(activeCycle.id)}
                    disabled={anyLoading}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-saffron/15 border border-saffron/40 text-saffron text-[13px] font-medium rounded-lg hover:bg-saffron/25 disabled:opacity-40 transition-all"
                  >
                    {anyLoading ? '…' : '⟳ Run carry-forward'}
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Topic rows */}
          <div className="space-y-2.5">
            {topics.length === 0 && (
              <p className="text-[13px] text-cha italic px-1">No topics submitted yet.</p>
            )}
            {topics.map((topic: any) => (
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
                  <div className="shrink-0 text-right min-w-[56px]">
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
                  <button
                    onClick={() => {
                      setEditingOutcome(topic.id === editingOutcome ? null : topic.id)
                      setOutcomeTag(topic.outcome_tag ?? 'discussed')
                      setOutcomeNote(topic.outcome_note ?? '')
                    }}
                    className="px-3 py-1.5 text-[12px] font-medium bg-kinu border border-border text-ink-soft rounded-lg hover:text-ink hover:border-border-strong transition-all"
                  >
                    {topic.outcome_tag ? `✎ ${OUTCOME_LABELS[topic.outcome_tag]}` : 'Tag outcome'}
                  </button>
                </div>

                {/* Outcome form */}
                {editingOutcome === topic.id && (
                  <div className="mt-3 pt-3 border-t border-border space-y-3">
                    <div className="flex flex-wrap gap-1.5">
                      {VALID_OUTCOMES.map(tag => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => setOutcomeTag(tag)}
                          className={cn(
                            'px-2.5 py-1 text-[11px] font-medium rounded-full border transition-all',
                            outcomeTag === tag
                              ? OUTCOME_COLORS[tag]
                              : 'border-border text-cha hover:border-border-strong hover:text-ink-soft',
                          )}
                        >
                          {OUTCOME_LABELS[tag]}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={outcomeNote}
                      onChange={e => setOutcomeNote(e.target.value)}
                      maxLength={500}
                      rows={2}
                      placeholder="Optional outcome note…"
                      className="w-full px-3 py-2 bg-sumi border border-border-strong rounded-lg text-[12px] text-ink resize-none focus:outline-none focus:ring-1 focus:ring-saffron/40 placeholder:text-cha"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveOutcome(topic.id)}
                        disabled={anyLoading}
                        className="px-4 py-1.5 bg-saffron text-parchment text-[12px] font-semibold rounded-lg hover:bg-saffron/90 disabled:opacity-40 transition-all"
                      >
                        {isLoading(`outcome-${topic.id}`) ? 'Saving…' : 'Save outcome'}
                      </button>
                      <button
                        onClick={() => setEditingOutcome(null)}
                        className="px-3 py-1.5 text-[12px] text-cha hover:text-ink-soft transition-colors"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ─── Close confirmation modal ─── */}
      {confirmClose && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-parchment/75 backdrop-blur-sm" onClick={() => setConfirmClose(null)} />
          <div className="relative w-full max-w-md mx-4 bg-paper border border-border-strong rounded-xl shadow-2xl p-6 animate-fade-up">
            <h3 className="font-serif text-lg font-semibold text-ink mb-2">Close this cycle?</h3>
            <p className="text-[13px] text-ink-soft mb-1">
              You're about to close <span className="font-semibold text-ink">{confirmClose.label}</span>.
            </p>
            <p className="text-[12px] text-cha mb-6">
              This starts the 48-hour spark window and prevents new votes or contributions. You can still reopen the cycle afterwards.
            </p>
            <div className="flex gap-3">
              <button
                onClick={confirmCloseAction}
                disabled={anyLoading}
                className="px-5 py-2.5 bg-vermillion/20 border border-vermillion/40 text-vermillion text-[13px] font-semibold rounded-lg hover:bg-vermillion/30 disabled:opacity-40 transition-all"
              >
                🔒 Yes, close cycle
              </button>
              <button
                onClick={() => setConfirmClose(null)}
                className="px-5 py-2.5 bg-kinu border border-border text-ink-soft text-[13px] font-medium rounded-lg hover:bg-kinu/80 hover:text-ink transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
