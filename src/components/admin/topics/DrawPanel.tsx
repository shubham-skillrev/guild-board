'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowsClockwise, Shuffle } from '@phosphor-icons/react/dist/ssr'
import { Kers } from '@/components/kers/Kers'
import { Button } from '@/components/ui/Button'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/utils/cn'

export interface DrawView {
  id: string
  kind: 'spotlight' | 'demo'
  round: number
  status: 'review' | 'inviting' | 'filled' | 'failed' | 'cancelled'
  reviewUntil: string | null
  picks: { id: string; position: number; username: string; tickets: number; state: string }[]
}

const STATE: Record<string, string> = {
  waiting: 'Reserve',
  invited: 'Invited · 3 days to answer',
  accepted: 'Said yes',
  passed: 'Passed',
  expired: 'No answer',
  swapped: 'Swapped out',
}

const STATUS: Record<DrawView['status'], string> = {
  review: 'Your review: swap anyone before the invitations go',
  inviting: 'Invitations out',
  filled: 'Filled',
  failed: 'Nobody said yes',
  cancelled: 'Replaced by a direct invitation',
}

/**
 * Kers' draw for this month, for admins only: who was drawn (and with how
 * many tickets), where each invitation stands, and during the review day a
 * way to swap anyone or send the invitations early. The guild never sees
 * any of this; it only hears about people who said yes.
 */
export function DrawPanel({ draws, members, canDraw }: { draws: DrawView[]; members: { id: string; label: string }[]; canDraw: boolean }) {
  const router = useRouter()
  const toast = useToast()
  const [busy, setBusy] = useState<string | null>(null)

  const call = async (key: string, payload: Record<string, unknown>, done: string) => {
    setBusy(key)
    try {
      const res = await fetch('/api/admin/draw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not do that')
      toast(done, 'success')
      router.refresh()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not do that', 'error')
    } finally {
      setBusy(null)
    }
  }

  const live = draws.filter(d => d.status !== 'failed' || !draws.some(x => x.kind === d.kind && x.round > d.round))

  return (
    <section aria-labelledby="admin-draw" className="rounded-[20px] border border-border bg-paper p-5 sm:p-6">
      <div className="flex flex-wrap items-start gap-4">
        <Kers size={56} expression="nosy" className="shrink-0" />
        <div className="min-w-0 flex-1">
          <h2 id="admin-draw" className="text-[17px] font-semibold tracking-[-0.01em] text-ink">Kers’ draw</h2>
          <p className="mt-0.5 text-footnote text-ink-muted">
            Two names per open slot, weighted towards the willing (volunteered or nominated ×3, “could show” ×2). Only you see this; the guild only
            hears about a yes.
          </p>
        </div>
        {canDraw && (
          <Button variant="secondary" icon={Shuffle} disabled={!!busy} onClick={() => call('draw', { action: 'draw' }, 'Kers drew')}>
            {busy === 'draw' ? 'Drawing…' : 'Draw now'}
          </Button>
        )}
      </div>

      {live.length === 0 ? (
        <p className="mt-4 text-footnote text-ink-muted">
          No draw this month yet. Kers draws on his own the morning a month opens, for any slot nobody has taken.
        </p>
      ) : (
        <div className="mt-5 grid gap-4 md:grid-cols-2">
          {live.map(d => (
            <div key={d.id} className="rounded-(--radius-card) border border-border p-4">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-footnote font-medium text-ink">{d.kind === 'spotlight' ? 'Spotlight' : 'Demo'}{d.round === 2 ? ' · redraw' : ''}</p>
                <p className="text-meta text-ink-muted">{STATUS[d.status]}</p>
              </div>
              {d.status === 'review' && d.reviewUntil && (
                <p className="mt-0.5 text-meta text-ink-muted">
                  Invitations go out {new Date(d.reviewUntil).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', hour: 'numeric', minute: '2-digit' })} unless you send them now.
                </p>
              )}
              <ol className="mt-3 space-y-2">
                {d.picks.map(p => (
                  <li key={p.id} className="flex items-center gap-2.5">
                    <UserAvatar username={p.username} size={28} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-footnote text-ink">@{p.username} <span className="text-meta text-ink-muted">· {p.tickets} ticket{p.tickets === 1 ? '' : 's'}</span></p>
                      <p className={cn('text-meta', p.state === 'accepted' ? 'text-ink' : 'text-ink-muted')}>{p.position === 1 && p.state === 'waiting' ? 'First up' : STATE[p.state] ?? p.state}</p>
                    </div>
                    {d.status === 'review' && (
                      <div className="flex shrink-0 items-center gap-1">
                        <select
                          aria-label={`Swap @${p.username} for`}
                          defaultValue=""
                          disabled={!!busy}
                          onChange={e => e.target.value && call(p.id, { action: 'swap', pick_id: p.id, user_id: e.target.value }, 'Swapped')}
                          className="h-7 max-w-[8rem] rounded-(--radius-control) border border-border bg-paper px-1.5 text-meta text-ink"
                        >
                          <option value="">Swap for…</option>
                          {members.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}
                        </select>
                        <button type="button" disabled={!!busy} onClick={() => call(p.id, { action: 'swap', pick_id: p.id }, 'Kers drew someone else')} aria-label="Draw someone else" className="press-sm rounded p-1 text-ink-muted hover:text-ink">
                          <ArrowsClockwise className="size-4" />
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ol>
              {d.status === 'review' && (
                <Button size="sm" variant="secondary" className="mt-3" disabled={!!busy} onClick={() => call(d.id, { action: 'send', draw_id: d.id }, 'Invitation sent')}>
                  Send the invitation now
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
