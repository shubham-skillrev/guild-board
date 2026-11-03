'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Bell } from '@phosphor-icons/react/dist/ssr'
import { cn } from '@/lib/utils/cn'
import { ago, useNotifications, type NotificationItem } from '@/components/notifications/useNotifications'

/**
 * The bell in the top bar: a dot with the unread count, and the latest
 * notifications in a panel. Everything GuildBoard sends you is here, whether
 * or not you turned push on. Escape or a click outside closes it.
 */
export function NotificationBell() {
  const router = useRouter()
  const { items, unread, loaded, markRead, markAll } = useNotifications(20)
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  const go = (n: NotificationItem) => {
    if (!n.read_at) markRead(n.id)
    setOpen(false)
    if (n.url) router.push(n.url)
  }

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        className="press relative inline-flex size-9 items-center justify-center rounded-full border border-border text-ink-soft transition-colors hover:bg-kinu/60 hover:text-ink"
      >
        <Bell className="size-4" weight={unread ? 'fill' : 'regular'} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-saffron px-1 text-[10px] font-semibold leading-none text-parchment tabular-nums">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="fixed inset-x-3 top-16 z-(--z-overlay) mt-1 overflow-hidden rounded-(--radius-card) border border-border-strong bg-paper shadow-[0_18px_50px_var(--shadow-tint-strong)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-full sm:w-[380px]"
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-footnote font-semibold text-ink">Notifications</p>
            {unread > 0 && <button type="button" onClick={markAll} className="text-meta text-ink-muted hover:text-ink">Mark all read</button>}
          </div>
          <ul className="max-h-[min(70vh,480px)] overflow-y-auto overscroll-contain">
            {!loaded ? (
              <li className="px-4 py-8 text-center text-footnote text-ink-muted">Loading…</li>
            ) : items.length === 0 ? (
              <li className="px-4 py-8 text-center text-footnote text-ink-muted">Nothing yet. Kers will let you know.</li>
            ) : (
              items.map(n => (
                <li key={n.id} className="border-b border-separator last:border-0">
                  <button type="button" onClick={() => go(n)} className={cn('flex w-full gap-3 px-4 py-3 text-left transition-colors hover:bg-kinu/40', !n.read_at && 'bg-kinu/25')}>
                    <span aria-hidden className={cn('mt-1.5 size-2 shrink-0 rounded-full', n.read_at ? 'bg-transparent' : 'bg-saffron')} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-3">
                        <span className={cn('truncate text-footnote', n.read_at ? 'text-ink-soft' : 'font-medium text-ink')}>{n.title}</span>
                        <span className="shrink-0 text-[11px] text-ink-muted tabular-nums">{ago(n.created_at)}</span>
                      </span>
                      {n.body && <span className="mt-0.5 line-clamp-2 block text-meta leading-snug text-ink-muted">{n.body}</span>}
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
          <Link href="/notifications" onClick={() => setOpen(false)} className="block border-t border-border px-4 py-2.5 text-center text-meta text-ink-muted hover:bg-kinu/40 hover:text-ink">
            See all
          </Link>
        </div>
      )}
    </div>
  )
}
