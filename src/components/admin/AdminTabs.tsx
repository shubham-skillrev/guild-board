'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils/cn'

const TABS = [
  { href: '/admin', label: 'Pulse' },
  { href: '/admin/people', label: 'People' },
  { href: '/admin/topics', label: 'Topics' },
  { href: '/admin/survey', label: 'Survey' },
  { href: '/admin/run', label: 'Run' },
] as const

/** The control room's tabs, each its own URL. Viewers don't get Run. Scrolls
 *  sideways on a narrow phone, with the scrollbar hidden (it showed as a stray
 *  bar at the end of the row on desktop). */
export function AdminTabs({ readOnly = false }: { readOnly?: boolean }) {
  const pathname = usePathname()
  const tabs = readOnly ? TABS.filter(t => t.href !== '/admin/run') : TABS
  return (
    <nav aria-label="Control room" className="print:hidden -mx-1 flex gap-1 overflow-x-auto border-b border-border px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {tabs.map(t => {
        const active = t.href === '/admin' ? pathname === '/admin' : pathname.startsWith(t.href)
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'press-sm -mb-px whitespace-nowrap border-b-2 px-3 py-2.5 text-footnote transition-colors',
              active ? 'border-ink text-ink font-medium' : 'border-transparent text-ink-muted hover:text-ink',
            )}
          >
            {t.label}
          </Link>
        )
      })}
    </nav>
  )
}
