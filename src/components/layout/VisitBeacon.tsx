'use client'

import { useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/** The fixed set of areas record_visit accepts (migration 038). */
function areaOf(path: string): string {
  if (path === '/board') return 'board'
  if (path.startsWith('/board/')) return 'topic'
  if (path.startsWith('/bytes')) return 'bytes'
  if (path.startsWith('/bank')) return 'bank'
  if (path.startsWith('/leaderboard')) return 'leaderboard'
  if (path.startsWith('/profile')) return 'profile'
  if (path.startsWith('/admin')) return 'admin'
  if (path.startsWith('/survey')) return 'survey'
  return 'other'
}

/* The same area again within ten minutes adds nothing the daily row doesn't
   already say, so it isn't sent. */
const QUIET_MS = 10 * 60 * 1000

function pushState(): string {
  if (typeof window === 'undefined' || !('Notification' in window)) return 'unsupported'
  return Notification.permission
}

function isInstalledApp(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/**
 * Notes that a signed-in member was here: one row per day with the areas they
 * opened, whether it was the installed app, and their notification setting.
 * The member comes from the session inside record_visit, so this can only
 * ever write the caller's own row. Renders nothing; mount it only for members.
 */
export function VisitBeacon() {
  const pathname = usePathname()

  useEffect(() => {
    const area = areaOf(pathname)
    const key = `gb-visit:${area}`
    try {
      const last = Number(sessionStorage.getItem(key) ?? 0)
      if (Date.now() - last < QUIET_MS) return
      sessionStorage.setItem(key, String(Date.now()))
    } catch {}

    createClient()
      .rpc('record_visit', { p_area: area, p_app: isInstalledApp(), p_push: pushState() })
      .then(({ error }) => {
        // Before migration 038 the function doesn't exist; stay quiet.
        if (error && error.code !== 'PGRST202') console.warn('record_visit:', error.message)
      })
  }, [pathname])

  return null
}
