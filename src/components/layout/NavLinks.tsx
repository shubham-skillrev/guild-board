'use client'

import { Lightbulb, ShieldCheck, SquaresFour, Trophy } from '@phosphor-icons/react/dist/ssr'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { useUnseenDigest } from '@/lib/bytes/useUnseenDigest'
import { cn } from '@/lib/utils/cn'

interface NavLinksProps {
  role?: string
  username?: string | null
}

export function DesktopNavLinks({ role }: NavLinksProps) {
  const pathname = usePathname()
  const { unseen: unseenBytes } = useUnseenDigest()
  const isBoard = pathname.startsWith('/board')
  const isBank = pathname.startsWith('/bank')
  const isBytes = pathname.startsWith('/bytes')
  const isLeaders = pathname.startsWith('/leaderboard')
  const isAdmin = pathname.startsWith('/admin')

  return (
    <nav className="hidden md:flex items-center gap-0.5 text-[13px] font-medium">
      <Link
        href="/board"
        className={cn(
          'px-3 py-2 border-b-2 transition-colors press',
          isBoard ? 'text-ink border-saffron' : 'text-ink-soft border-transparent hover:text-ink'
        )}
      >
        Board
      </Link>
      <Link
        href="/bank"
        className={cn(
          'px-3 py-2 border-b-2 transition-colors press',
          isBank ? 'text-ink border-saffron' : 'text-ink-soft border-transparent hover:text-ink'
        )}
      >
        Ideas
      </Link>
      <Link
        href="/bytes"
        className={cn(
          'relative px-3 py-2 border-b-2 transition-colors press',
          isBytes ? 'text-ink border-saffron' : 'text-ink-soft border-transparent hover:text-ink'
        )}
      >
        Bytes
        {/* A digest published since this browser last opened the page. Dropped
            the moment you are on /bytes, so it never sits there while you read
            the thing it is pointing at. */}
        {unseenBytes && !isBytes && (
          <span
            aria-label="New digest"
            className="absolute top-1.5 right-0.5 w-1.5 h-1.5 rounded-full bg-saffron"
          />
        )}
      </Link>
      <Link
        href="/leaderboard"
        className={cn(
          'px-3 py-2 border-b-2 transition-colors press',
          isLeaders ? 'text-ink border-saffron' : 'text-ink-soft border-transparent hover:text-ink'
        )}
      >
        Leaderboard
      </Link>
      {role === 'admin' && (
        <Link
          href="/admin"
          className={cn(
            'px-3 py-2 border-b-2 transition-colors press',
            isAdmin ? 'text-saffron border-saffron' : 'text-saffron/80 border-transparent hover:text-saffron'
          )}
        >
          Admin
        </Link>
      )}
    </nav>
  )
}

export function MobileBottomNav({ role, username }: NavLinksProps) {
  const pathname = usePathname()
  const isBoard = pathname.startsWith('/board')
  const isBank = pathname.startsWith('/bank')
  const isLeaders = pathname.startsWith('/leaderboard')
  const isAdmin = pathname.startsWith('/admin')
  const isProfile = pathname.startsWith('/profile')

  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const nav = (
    /* Same material as the top bar. `material-chrome` mixes the page ground
       with transparency, and on a near-black page that lands on the ground
       colour itself, so it read as a flat opaque strip. Paper sits a step
       above the ground, so the blur is actually visible against it. */
    <nav className="md:hidden fixed inset-x-0 bottom-0 z-(--z-chrome) bg-paper/80 backdrop-blur-xl border-t border-border pb-[env(safe-area-inset-bottom)]">
      <div className={cn('grid px-2 py-1.5', role === 'admin' ? 'grid-cols-5' : 'grid-cols-4')}>
        <Link
          href="/board"
          className={cn(
            'flex flex-col items-center justify-center gap-1 py-1.5 text-[11px] transition-colors rounded-lg press-sm',
            isBoard ? 'text-ink bg-kinu/80' : 'text-ink-soft hover:text-ink'
          )}
        >
          <SquaresFour className="w-4.5 h-4.5" />
          <span>Board</span>
        </Link>
        <Link
          href="/bank"
          className={cn(
            'flex flex-col items-center justify-center gap-1 py-1.5 text-[11px] transition-colors rounded-lg press-sm',
            isBank ? 'text-ink bg-kinu/80' : 'text-ink-soft hover:text-ink'
          )}
        >
          <Lightbulb className="w-4.5 h-4.5" />
          <span>Ideas</span>
        </Link>
        <Link
          href="/leaderboard"
          className={cn(
            'flex flex-col items-center justify-center gap-1 py-1.5 text-[11px] transition-colors rounded-lg press-sm',
            isLeaders ? 'text-ink bg-kinu/80' : 'text-ink-soft hover:text-ink'
          )}
        >
          <Trophy className="w-4.5 h-4.5" />
          <span>Leaders</span>
        </Link>
        {role === 'admin' && (
          <Link
            href="/admin"
            className={cn(
              'flex flex-col items-center justify-center gap-1 py-1.5 text-[11px] transition-colors rounded-lg press-sm',
              isAdmin ? 'text-saffron bg-saffron-light/60' : 'text-saffron/80 hover:text-saffron'
            )}
          >
            <ShieldCheck className="w-4.5 h-4.5" />
            <span>Admin</span>
          </Link>
        )}
        <Link
          href="/profile"
          className={cn(
            'flex flex-col items-center justify-center gap-1 py-1 text-[11px] transition-colors rounded-lg press-sm',
            isProfile ? 'text-ink bg-kinu/80' : 'text-ink-soft hover:text-ink'
          )}
        >
          <span className="w-5.5 h-5.5 rounded-full overflow-hidden border border-border-strong">
            <UserAvatar username={username ?? 'user'} size={22} />
          </span>
          <span>You</span>
        </Link>
      </div>
    </nav>
  )

  if (!mounted) return null
  return createPortal(nav, document.body)
}