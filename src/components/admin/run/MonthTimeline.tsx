'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/utils/cn'
import type { Cycle } from '@/types'

const STAGES = [
  { key: 'open', label: 'Open for posts' },
  { key: 'frozen', label: 'Posting frozen' },
  { key: 'meeting', label: 'Meeting' },
  { key: 'closed', label: 'Closed' },
] as const

function fmt(iso: string | null | undefined): string {
  if (!iso) return 'not set'
  return new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })
}

/** ISO instant to a datetime-local value in India time. */
function toLocalInput(iso: string | null): string {
  if (!iso) return ''
  const d = new Date(new Date(iso).getTime() + 5.5 * 3_600_000)
  return d.toISOString().slice(0, 16)
}

/**
 * Where the month is, as one track: open for posts → frozen → meeting →
 * closed. The current stage is lit; the next step is the one button; the
 * meeting time is editable in place.
 */
export function MonthTimeline({ cycle }: { cycle: Cycle }) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)
  const [editing, setEditing] = useState(false)
  const [meetingAt, setMeetingAt] = useState(toLocalInput(cycle.meeting_at))

  const meetingPassed = !!cycle.meeting_at && new Date(cycle.meeting_at).getTime() < Date.now()
  const current =
    cycle.status === 'closed' ? 3 : meetingPassed ? 2 : cycle.status === 'frozen' ? 1 : cycle.status === 'open' ? 0 : -1

  const call = async (key: string, url: string, method: string, payload: unknown, done: string) => {
    setBusy(key)
    try {
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not do that')
      toast(done, 'success')
      router.refresh()
      return true
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not do that', 'error')
      return false
    } finally {
      setBusy(null)
    }
  }

  const setStatus = (status: 'open' | 'frozen' | 'closed', done: string, ask?: string) => {
    if (ask && !window.confirm(ask)) return
    return call(status, '/api/admin/cycle-control', 'PATCH', { cycle_id: cycle.id, status }, done)
  }

  const saveDate = async () => {
    const iso = meetingAt ? new Date(`${meetingAt}:00+05:30`).toISOString() : null
    if (await call('date', '/api/admin/cycles', 'PATCH', { cycle_id: cycle.id, meeting_at: iso }, 'Meeting time saved')) setEditing(false)
  }

  const next =
    cycle.status === 'upcoming' ? { label: 'Open the month', run: () => setStatus('open', 'The month is open', 'Open this month? Everyone gets the month-open message.') }
    : cycle.status === 'open' ? { label: 'Freeze posting', run: () => setStatus('frozen', 'Posting frozen: the list is set for the meeting') }
    : cycle.status === 'frozen' ? { label: 'Close the month', run: () => setStatus('closed', 'Closed. Next month opens tomorrow morning.', 'Close this month? The board locks, sparks stay open 48 hours, and everyone gets a push. Autopilot opens next month the next morning.') }
    : null

  return (
    <section aria-labelledby="run-timeline" className="rounded-[20px] border border-border bg-paper p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">This month</p>
          <h2 id="run-timeline" className="mt-1 text-[22px] font-semibold tracking-[-0.02em] text-ink">{cycle.label}</h2>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {cycle.status === 'frozen' && (
            <Button variant="ghost" disabled={!!busy} onClick={() => setStatus('open', 'Posting reopened')}>Reopen posting</Button>
          )}
          {next && <Button disabled={!!busy} onClick={next.run}>{busy && busy !== 'date' ? 'Working…' : next.label}</Button>}
          {!next && <p className="text-footnote text-ink-muted">Next month opens on its own the morning after.</p>}
        </div>
      </div>

      {/* The track. */}
      <ol className="mt-6 grid grid-cols-4 gap-2">
        {STAGES.map((s, i) => (
          <li key={s.key} className="min-w-0">
            <div className="flex items-center">
              <span
                aria-hidden
                className={cn(
                  'size-3.5 shrink-0 rounded-full border-2',
                  i < current ? 'border-ink bg-ink' : i === current ? 'border-ink bg-ink shadow-[0_0_0_4px_color-mix(in_oklab,var(--color-ink)_15%,transparent)]' : 'border-border-strong bg-paper',
                )}
              />
              {i < STAGES.length - 1 && <span aria-hidden className={cn('h-0.5 flex-1', i < current ? 'bg-ink' : 'bg-border')} />}
            </div>
            <p className={cn('mt-2 text-footnote', i === current ? 'font-medium text-ink' : 'text-ink-muted')}>
              {s.label}
              {i === current && <span className="sr-only"> (now)</span>}
            </p>
            <p className="text-meta text-ink-muted truncate">
              {s.key === 'open' ? fmt(cycle.opens_at) : s.key === 'frozen' ? fmt(cycle.freezes_at) : s.key === 'meeting' ? fmt(cycle.meeting_at) : cycle.status === 'closed' ? 'done' : '—'}
            </p>
          </li>
        ))}
      </ol>

      <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4 text-footnote">
        <span className="text-ink-muted">Meeting:</span>
        {editing ? (
          <>
            <input
              type="datetime-local"
              value={meetingAt}
              onChange={e => setMeetingAt(e.target.value)}
              className="h-8 rounded-(--radius-control) border border-border bg-paper px-2 text-footnote text-ink"
              aria-label="Meeting time (India)"
            />
            <Button size="sm" disabled={busy === 'date'} onClick={saveDate}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          </>
        ) : (
          <>
            <span className="text-ink">{fmt(cycle.meeting_at)} IST</span>
            <button type="button" onClick={() => setEditing(true)} className="text-ink-muted underline underline-offset-2 hover:text-ink">Change</button>
          </>
        )}
      </div>
    </section>
  )
}
