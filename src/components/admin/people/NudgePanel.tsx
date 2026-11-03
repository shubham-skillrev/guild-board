'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Sparkle, X } from '@phosphor-icons/react/dist/ssr'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Textarea } from '@/components/ui/Input'
import { useToast } from '@/hooks/useToast'
import { NUDGE_MAX, levelLabel, type Person } from '@/lib/people'

function channelOf(p: Person): string {
  if (!p.member) return 'Slack: copy and paste'
  return p.push ? 'Push + a card on their board' : 'A card on their board'
}

/**
 * Who you picked, and the note to send them. Kers drafts from each person's
 * own answers; you edit; it goes out under your name. Anyone who turned
 * nudges off or heard from the guild in the last 14 days is left out.
 */
export function NudgePanel({
  picked,
  segment,
  teams,
  onClear,
  onRemove,
}: {
  picked: Person[]
  segment: string
  teams: { id: string; name: string }[]
  onClear: () => void
  onRemove: (key: string) => void
}) {
  const router = useRouter()
  const toast = useToast()
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<'draft' | 'send' | null>(null)
  const [sentCopies, setSentCopies] = useState<{ name: string; body: string }[]>([])

  const reachable = picked.filter(p => p.canNudge)
  const blocked = picked.filter(p => !p.canNudge)

  const draft = async () => {
    setBusy('draft')
    try {
      const res = await fetch('/api/admin/nudges/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keys: reachable.map(p => p.key) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Kers could not draft')
      setDrafts(Object.fromEntries((data.drafts as { key: string; body: string }[]).map(d => [d.key, d.body])))
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Kers could not draft', 'error')
    } finally {
      setBusy(null)
    }
  }

  const send = async () => {
    const items = reachable.filter(p => drafts[p.key]?.trim()).map(p => ({ key: p.key, body: drafts[p.key] }))
    if (!items.length) return
    setBusy('send')
    try {
      const res = await fetch('/api/admin/nudges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items, segment: segment === 'all' ? null : segment }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not send')
      const sent = new Set<string>(data.sent)
      setSentCopies(reachable.filter(p => sent.has(p.key) && !p.member).map(p => ({ name: p.name, body: drafts[p.key] })))
      toast(`Sent ${sent.size}${data.skipped?.length ? `, skipped ${data.skipped.length}` : ''}`, 'success')
      setDrafts({})
      router.refresh()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not send', 'error')
    } finally {
      setBusy(null)
    }
  }

  const assign = async (p: Person, teamId: string) => {
    const res = await fetch('/api/admin/teams', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'assign', user_id: p.userId, team_id: teamId || null }),
    }).catch(() => null)
    if (res?.ok) router.refresh()
    else toast('Could not move them', 'error')
  }

  if (!picked.length && !sentCopies.length) {
    return (
      <div className="rounded-(--radius-card) border border-dashed border-border-strong p-5 text-footnote text-ink-muted">
        Pick a window (or a few, or a whole group with the chips above) to see who they are and send a note.
      </div>
    )
  }

  const one = picked.length === 1 ? picked[0] : null

  return (
    <div className="space-y-4">
      {sentCopies.length > 0 && (
        <div className="rounded-(--radius-card) border border-border bg-paper p-4">
          <p className="text-footnote font-medium text-ink">Paste these into Slack</p>
          <p className="text-meta text-ink-muted">They have no account yet, so GuildBoard can’t reach them. Logged as sent.</p>
          <ul className="mt-3 space-y-2">
            {sentCopies.map(c => (
              <li key={c.name} className="flex items-start gap-2">
                <p className="min-w-0 flex-1 text-footnote text-ink-soft"><span className="text-ink">{c.name}:</span> {c.body}</p>
                <Button size="sm" variant="secondary" icon={Copy} onClick={() => navigator.clipboard.writeText(c.body).then(() => toast('Copied', 'success'))}>Copy</Button>
              </li>
            ))}
          </ul>
          <Button size="sm" variant="ghost" className="mt-2" onClick={() => setSentCopies([])}>Done</Button>
        </div>
      )}

      {one && (
        <div className="rounded-(--radius-card) border border-border bg-paper p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[15px] font-semibold text-ink">{one.name}</p>
              <p className="text-meta text-ink-muted">{one.username ? `@${one.username} · ` : ''}{one.email}</p>
            </div>
            <button type="button" onClick={onClear} aria-label="Clear" className="press p-1 text-ink-muted hover:text-ink"><Icon icon={X} size="sm" /></button>
          </div>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-footnote">
            <dt className="text-ink-muted">Level</dt><dd className="text-ink">{one.member ? levelLabel(one.level) : 'No account'}</dd>
            <dt className="text-ink-muted">Last here</dt><dd className="text-ink">{one.lastSeen ?? '—'}</dd>
            <dt className="text-ink-muted">Posts · comments*</dt><dd className="text-ink tabular">{one.namedPosts} · {one.namedComments}</dd>
            <dt className="text-ink-muted">Votes · demos</dt><dd className="text-ink tabular">{one.votes} · {one.demos}</dd>
            <dt className="text-ink-muted">App · push</dt><dd className="text-ink">{one.app ? 'Yes' : 'No'} · {one.push ? 'On' : 'Off'}</dd>
            {one.survey?.demoIdea && (<><dt className="text-ink-muted">Could show</dt><dd className="text-ink">{one.survey.demoIdea}</dd></>)}
            {one.survey?.learnNext && (<><dt className="text-ink-muted">Wants to learn</dt><dd className="text-ink">{one.survey.learnNext}</dd></>)}
          </dl>
          {one.member && one.userId && (
            <label className="mt-3 flex items-center gap-2 text-footnote text-ink-muted">
              Team
              <select
                value={one.teamId ?? ''}
                onChange={e => assign(one, e.target.value)}
                className="h-8 flex-1 rounded-(--radius-control) border border-border bg-paper px-2 text-footnote text-ink"
              >
                <option value="">No team</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            </label>
          )}
          <p className="mt-2 text-meta text-ink-muted">* Under their own name only.</p>
        </div>
      )}

      {!one && (
        <div className="rounded-(--radius-card) border border-border bg-paper p-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-footnote font-medium text-ink">{picked.length} picked</p>
            <Button size="sm" variant="ghost" onClick={onClear}>Clear</Button>
          </div>
        </div>
      )}

      {blocked.length > 0 && (
        <p className="text-meta text-ink-muted">
          Leaving out {blocked.map(p => p.name).join(', ')}: {blocked.every(p => p.nudgesOff) ? 'they turned nudges off' : 'nudges off, or heard from the guild in the last 14 days'}.
        </p>
      )}

      {reachable.length > 0 && (
        <div className="space-y-3">
          {!reachable.some(p => p.key in drafts) ? (
            <Button variant="tinted" icon={Sparkle} className="w-full" disabled={busy === 'draft'} onClick={draft}>
              {busy === 'draft' ? 'Kers is writing…' : `Draft ${reachable.length === 1 ? 'a note' : `${reachable.length} notes`} with Kers`}
            </Button>
          ) : (
            <>
              <ul className="space-y-3">
                {reachable.map(p => (
                  <li key={p.key}>
                    <div className="mb-1 flex items-baseline justify-between gap-2 text-meta text-ink-muted">
                      <span className="text-ink">{p.name}</span>
                      <span>{channelOf(p)}</span>
                    </div>
                    <Textarea
                      rows={4}
                      maxLength={NUDGE_MAX}
                      value={drafts[p.key] ?? ''}
                      onChange={e => setDrafts(d => ({ ...d, [p.key]: e.target.value }))}
                      className="font-sans text-footnote"
                      aria-label={`Note to ${p.name}`}
                    />
                    {picked.length > 1 && (
                      <button type="button" onClick={() => onRemove(p.key)} className="mt-1 text-meta text-ink-muted hover:text-ink">Leave {p.name} out</button>
                    )}
                  </li>
                ))}
              </ul>
              <div className="flex gap-2">
                <Button className="flex-1" disabled={busy === 'send'} onClick={send}>
                  {busy === 'send' ? 'Sending…' : `Send ${reachable.filter(p => drafts[p.key]?.trim()).length}`}
                </Button>
                <Button variant="ghost" onClick={() => setDrafts({})}>Discard</Button>
              </div>
              <p className="text-meta text-ink-muted">Goes out under your name. One per person per 14 days.</p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
