'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { SectionHeader } from '@/components/ui/Section'
import { useToast } from '@/hooks/useToast'

/**
 * Teams and their leads. A lead gets a "Team" link to Pulse for their team:
 * totals only, nothing about one person. Move people between teams from
 * their card in the hall.
 */
export function TeamsPanel({
  teams,
  members,
  counts,
}: {
  teams: { id: string; name: string; leadId: string | null }[]
  members: { id: string; label: string }[]
  counts: Record<string, number>
}) {
  const router = useRouter()
  const toast = useToast()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)

  const call = async (payload: Record<string, unknown>, done?: string) => {
    setBusy(true)
    try {
      const res = await fetch('/api/admin/teams', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not save')
      if (done) toast(done, 'success')
      router.refresh()
      return true
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save', 'error')
      return false
    } finally {
      setBusy(false)
    }
  }

  return (
    <section aria-labelledby="people-teams">
      <SectionHeader id="people-teams" title="Teams" hint="A lead sees their team's totals, never one person." />
      {teams.length > 0 && (
        <ul className="mb-3 divide-y divide-border border-y border-border">
          {teams.map(t => (
            <li key={t.id} className="flex flex-wrap items-center gap-2 py-2.5 text-footnote">
              <span className="min-w-0 flex-1 text-ink">{t.name} <span className="text-ink-muted">· {counts[t.id] ?? 0}</span></span>
              <select
                aria-label={`Lead of ${t.name}`}
                value={t.leadId ?? ''}
                disabled={busy}
                onChange={e => call({ action: 'lead', team_id: t.id, user_id: e.target.value || null }, 'Lead updated')}
                className="h-8 max-w-[11rem] rounded-(--radius-control) border border-border bg-paper px-2 text-footnote text-ink"
              >
                <option value="">No lead</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
              </select>
              <Button size="sm" variant="ghost" disabled={busy} onClick={() => call({ action: 'delete', team_id: t.id }, `${t.name} removed`)}>Remove</Button>
            </li>
          ))}
        </ul>
      )}
      <form
        className="flex gap-2"
        onSubmit={async e => {
          e.preventDefault()
          if (await call({ action: 'create', name }, 'Team added')) setName('')
        }}
      >
        <Input aria-label="New team name" placeholder="New team, e.g. Platform" maxLength={60} value={name} onChange={e => setName(e.target.value)} />
        <Button type="submit" variant="secondary" disabled={busy || !name.trim()}>Add</Button>
      </form>
    </section>
  )
}
