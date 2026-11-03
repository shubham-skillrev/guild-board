'use client'

import { useCallback, useEffect, useState } from 'react'

export interface NotificationItem {
  id: string
  kind: string
  title: string
  body: string | null
  url: string | null
  read_at: string | null
  created_at: string
}

/** "now", "5m", "3h", "2d", then a date. */
export function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86_400) return `${Math.floor(s / 3600)}h`
  if (s < 7 * 86_400) return `${Math.floor(s / 86_400)}d`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

/**
 * The member's inbox: the latest notifications and the unread count, kept
 * fresh every minute and whenever the tab comes back into focus.
 */
export function useNotifications(limit = 20) {
  const [items, setItems] = useState<NotificationItem[]>([])
  const [unread, setUnread] = useState(0)
  const [loaded, setLoaded] = useState(false)

  const load = useCallback(() => {
    fetch(`/api/notifications?limit=${limit}`, { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => {
        if (!d) return
        setItems(d.items)
        setUnread(d.unread)
        setLoaded(true)
      })
      .catch(() => {})
  }, [limit])

  useEffect(() => {
    load()
    const t = setInterval(load, 60_000)
    const onFocus = () => load()
    window.addEventListener('focus', onFocus)
    return () => { clearInterval(t); window.removeEventListener('focus', onFocus) }
  }, [load])

  const markRead = useCallback((id: string) => {
    setItems(list => list.map(n => (n.id === id && !n.read_at ? { ...n, read_at: new Date().toISOString() } : n)))
    setUnread(u => Math.max(0, u - 1))
    fetch('/api/notifications/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }).catch(() => {})
  }, [])

  const markAll = useCallback(() => {
    setItems(list => list.map(n => (n.read_at ? n : { ...n, read_at: new Date().toISOString() })))
    setUnread(0)
    fetch('/api/notifications/read', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true }) }).catch(() => {})
  }, [])

  return { items, unread, loaded, markRead, markAll, reload: load, setItems }
}
