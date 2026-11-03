'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'
import { ago, useNotifications, type NotificationItem } from '@/components/notifications/useNotifications'

function dayLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const y = new Date(Date.now() - 86_400_000)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === y.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })
}

/** Every notification from the last 90 days, by day, with "Load more". */
export function NotificationsList() {
  const router = useRouter()
  const { items, unread, loaded, markRead, markAll, setItems } = useNotifications(40)
  const [more, setMore] = useState(true)
  const [busy, setBusy] = useState(false)

  const loadMore = async () => {
    const last = items[items.length - 1]
    if (!last) return
    setBusy(true)
    const d = await fetch(`/api/notifications?limit=40&before=${encodeURIComponent(last.created_at)}`).then(r => r.json()).catch(() => null)
    setBusy(false)
    if (!d?.items?.length) { setMore(false); return }
    setItems(list => [...list, ...d.items])
    if (d.items.length < 40) setMore(false)
  }

  const go = (n: NotificationItem) => {
    if (!n.read_at) markRead(n.id)
    if (n.url) router.push(n.url)
  }

  const groups: { day: string; items: NotificationItem[] }[] = []
  for (const n of items) {
    const day = dayLabel(n.created_at)
    const g = groups[groups.length - 1]
    if (g?.day === day) g.items.push(n)
    else groups.push({ day, items: [n] })
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <p className="text-callout text-label-2">{unread ? `${unread} unread` : 'All caught up'}</p>
        {unread > 0 && <Button variant="secondary" onClick={markAll}>Mark all read</Button>}
      </div>
      {!loaded ? (
        <p className="text-footnote text-ink-muted">Loading…</p>
      ) : items.length === 0 ? (
        <p className="rounded-(--radius-card) border border-dashed border-border-strong p-8 text-center text-footnote text-ink-muted">
          Nothing yet. Replies, invitations, notes from the organisers and guild news will land here.
        </p>
      ) : (
        <div className="space-y-6">
          {groups.map(g => (
            <section key={g.day}>
              <h2 className="mb-2 text-meta text-ink-muted">{g.day}</h2>
              <ul className="elev-1 overflow-hidden rounded-(--radius-card) divide-y divide-separator">
                {g.items.map(n => (
                  <li key={n.id}>
                    <button type="button" onClick={() => go(n)} className={cn('flex w-full gap-3 px-4 py-3.5 text-left transition-colors hover:bg-kinu/40', !n.read_at && 'bg-kinu/25')}>
                      <span aria-hidden className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.read_at ? 'bg-transparent' : 'bg-saffron')} />
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline justify-between gap-3">
                          <span className={cn('text-footnote', n.read_at ? 'text-ink-soft' : 'font-medium text-ink')}>{n.title}</span>
                          <span className="shrink-0 text-[11px] text-ink-muted tabular-nums">{ago(n.created_at)}</span>
                        </span>
                        {n.body && <span className="mt-0.5 block text-meta leading-snug text-ink-muted">{n.body}</span>}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          {more && items.length >= 40 && (
            <div className="text-center">
              <Button variant="ghost" disabled={busy} onClick={loadMore}>{busy ? 'Loading…' : 'Load more'}</Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
