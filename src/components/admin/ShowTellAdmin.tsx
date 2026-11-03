'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { SectionHeader } from '@/components/ui/Section'
import { Button } from '@/components/ui/Button'
import { Input, Label } from '@/components/ui/Input'
import { useToast } from '@/hooks/useToast'
import { LIMITS, formatLabel, slackInvite, type DemoKind, type DemoStatus } from '@/lib/showtell'

export interface AdminDemo {
  id: string
  kind: DemoKind
  status: DemoStatus
  format: string
  title: string | null
  blurb: string | null
  note: string | null
  cycleId: string | null
  cycleLabel: string | null
  username: string
}

export interface Suggestion {
  kind: 'nomination' | 'volunteer'
  name: string
  why: string | null
  from: string | null
  userId: string | null
}

/**
 * Booking Show & Tell: invite someone to the Spotlight, book an offer into
 * the meeting, and keep track of who said yes. Survey nominations and
 * volunteers are listed as starting points.
 */
export function ShowTellAdmin({
  meeting,
  demos,
  members,
  suggestions,
  readOnly = false,
}: {
  /** A viewer sees what's booked and queued; no invitations, no passes. */
  readOnly?: boolean
  meeting: { id: string; label: string } | null
  demos: AdminDemo[]
  members: { id: string; label: string }[]
  suggestions: Suggestion[]
}) {
  const router = useRouter()
  const toast = useToast()
  const [who, setWho] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const memberId = useMemo(() => members.find(m => m.label === who)?.id ?? null, [members, who])

  const call = async (key: string, payload: Record<string, unknown>, done: string) => {
    setBusy(key)
    try {
      const res = await fetch('/api/admin/demos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
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

  const invite = async () => {
    if (!memberId) return
    if (await call('invite', { action: 'invite', user_id: memberId, note, cycle_id: meeting?.id }, 'Invitation sent. Copy a Slack message under “Waiting for an answer” to ask them personally.')) {
      setWho('')
      setNote('')
    }
  }

  const prefill = (s: Suggestion) => {
    const match = s.userId
      ? members.find(m => m.id === s.userId)
      : members.find(m => m.label.toLowerCase().includes(s.name.toLowerCase()))
    if (match) setWho(match.label)
    else toast(`${s.name} has no account yet. Ask them to join first (People tab can draft the message).`, 'info')
    if (s.why) setNote(s.why.slice(0, LIMITS.note))
  }

  const thisMeeting = demos.filter(d => d.status === 'confirmed' && d.cycleId === meeting?.id)
  const spotlight = thisMeeting.find(d => d.kind === 'spotlight')
  const demo = thisMeeting.find(d => d.kind === 'demo')
  const groups: { title: string; rows: AdminDemo[] }[] = [
    // Who's been invited and who passed is for admins only.
    ...(readOnly ? [] : [{ title: 'Waiting for an answer', rows: demos.filter(d => d.status === 'invited') }]),
    { title: 'Offers in the queue', rows: demos.filter(d => d.status === 'proposed') },
    { title: 'Booked', rows: demos.filter(d => d.status === 'confirmed') },
    ...(readOnly ? [] : [{ title: 'Passed recently', rows: demos.filter(d => d.status === 'passed').slice(0, 5) }]),
  ]

  return (
    <section id="showtell" aria-labelledby="admin-showtell" className="min-w-0 scroll-mt-24 space-y-6">
      <SectionHeader id="admin-showtell" title="Show & Tell" hint={meeting ? `${meeting.label} meeting · invite, book, keep track` : 'No open month'} />

      <div className="grid gap-x-10 gap-y-8 lg:grid-cols-2 items-start">
      <div className="min-w-0 space-y-6">
      <ul className="elev-1 rounded-(--radius-card) divide-y divide-separator text-footnote">
        {[['Spotlight', spotlight], ['Demo', demo]].map(([label, d]) => (
          <li key={label as string} className="flex items-baseline justify-between gap-3 px-4 py-3">
            <span className="text-ink-muted">{label as string}</span>
            {d ? (
              <span className="min-w-0 truncate text-right text-ink">
                @{(d as AdminDemo).username} · {(d as AdminDemo).title || formatLabel((d as AdminDemo).format)}
              </span>
            ) : (
              <span className="text-ink-muted">Open</span>
            )}
          </li>
        ))}
      </ul>

      {!readOnly && <div className="space-y-3 rounded-(--radius-card) border border-border bg-paper/60 p-4">
        <p className="text-footnote font-medium text-ink">Invite someone to the Spotlight</p>
        <div>
          <Label htmlFor="st-who">Member</Label>
          <Input id="st-who" list="st-members" value={who} onChange={e => setWho(e.target.value)} placeholder="Start typing a name" />
          <datalist id="st-members">
            {members.map(m => <option key={m.id} value={m.label} />)}
          </datalist>
        </div>
        <div>
          <Label htmlFor="st-note">Why them (shown on the invitation)</Label>
          <Input id="st-note" maxLength={LIMITS.note} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. fixed our flaky CI in a week" />
        </div>
        <Button onClick={invite} disabled={!memberId || busy === 'invite'} className="w-full">
          {busy === 'invite' ? 'Sending…' : 'Send invitation'}
        </Button>
        <p className="text-meta text-ink-muted">They get a push (if notifications are on) and a card on their board. Two passes a year, no pressure.</p>
      </div>}

      {!readOnly && suggestions.length > 0 && (
        <div>
          <p className="mb-2 text-footnote font-medium text-ink">From the survey</p>
          <ul className="divide-y divide-border border-y border-border">
            {suggestions.map((s, i) => (
              <li key={i} className="flex items-start gap-3 py-2.5">
                <div className="min-w-0 flex-1 text-footnote">
                  <p className="text-ink">
                    {s.name} <span className="text-ink-muted">· {s.kind === 'nomination' ? `nominated by ${s.from}` : 'could show something'}</span>
                  </p>
                  {s.why && <p className="text-ink-soft leading-snug">{s.why}</p>}
                </div>
                <Button size="sm" variant="secondary" onClick={() => prefill(s)}>Use</Button>
              </li>
            ))}
          </ul>
        </div>
      )}

      </div>

      <div className="min-w-0 space-y-6">
      {groups.every(g => g.rows.length === 0) && (
        <p className="rounded-(--radius-card) border border-dashed border-border-strong p-5 text-footnote text-ink-muted">
          No invitations or offers yet. Invite someone on the left, or wait for volunteers from the board.
        </p>
      )}
      {groups.map(g => g.rows.length > 0 && (
        <div key={g.title}>
          <p className="mb-2 text-footnote font-medium text-ink">{g.title} <span className="font-normal text-ink-muted">· {g.rows.length}</span></p>
          <ul className="divide-y divide-border border-y border-border">
            {g.rows.map(d => (
              <li key={d.id} className="py-2.5">
                <p className="text-footnote text-ink">
                  @{d.username} <span className="text-ink-muted">· {d.kind === 'spotlight' ? 'Spotlight' : 'Demo'} · {formatLabel(d.format)}{d.cycleLabel ? ` · ${d.cycleLabel}` : ' · no month yet'}</span>
                </p>
                {(d.title || d.blurb || d.note) && (
                  <p className="text-footnote leading-snug text-ink-soft">{d.title || d.note}{d.blurb ? ` · ${d.blurb}` : ''}</p>
                )}
                {!readOnly && <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {d.status === 'invited' && (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        navigator.clipboard
                          .writeText(slackInvite({ username: d.username, kind: d.kind, meeting: d.cycleLabel ?? meeting?.label ?? null, note: d.note }))
                          .then(() => toast(`Copied. Paste it in a DM to @${d.username}.`, 'success'))
                      }
                    >
                      Copy Slack message
                    </Button>
                  )}
                  {d.status === 'proposed' && meeting && (
                    <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => call(d.id, { action: 'confirm', id: d.id, cycle_id: meeting.id }, `Booked for ${meeting.label}`)}>
                      Book for {meeting.label}
                    </Button>
                  )}
                  {d.status === 'confirmed' && (
                    <>
                      <Button size="sm" variant="secondary" disabled={!!busy} onClick={() => call(d.id, { action: 'done', id: d.id }, 'Marked as done')}>Done</Button>
                      {d.kind === 'demo' && (
                        <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => call(d.id, { action: 'queue', id: d.id }, 'Back in the queue')}>Back to queue</Button>
                      )}
                    </>
                  )}
                  {d.status !== 'passed' && (
                    <Button size="sm" variant="ghost" disabled={!!busy} onClick={() => call(d.id, { action: 'cancel', id: d.id }, 'Cancelled')}>Cancel</Button>
                  )}
                </div>}
              </li>
            ))}
          </ul>
        </div>
      ))}
      </div>
      </div>
    </section>
  )
}
