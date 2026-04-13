'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { IoGridOutline, IoTrophyOutline, IoShieldCheckmarkOutline } from 'react-icons/io5'
import { cn } from '@/lib/utils/cn'

interface NavLinksProps {
  role?: string
  username?: string | null
}

export function DesktopNavLinks({ role }: NavLinksProps) {
  const pathname = usePathname()
  const isBoard = pathname.startsWith('/board')
  const isLeaders = pathname.startsWith('/leaderboard')
  const isAdmin = pathname.startsWith('/admin')

  return (
    <nav className="hidden sm:flex items-center gap-0.5 text-[13px] font-medium">
      <Link
        href="/board"
        className={cn(
          'px-3 py-2 border-b-2 transition-all',
          isBoard ? 'text-ink border-saffron' : 'text-ink-soft border-transparent hover:text-ink'
        )}
      >
        Board
      </Link>
      <Link
        href="/leaderboard"
        className={cn(
          'px-3 py-2 border-b-2 transition-all',
          isLeaders ? 'text-ink border-saffron' : 'text-ink-soft border-transparent hover:text-ink'
        )}
      >
        Leaderboard
      </Link>
      {role === 'admin' && (
        <Link
          href="/admin"
          className={cn(
            'px-3 py-2 border-b-2 transition-all',
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
  const isLeaders = pathname.startsWith('/leaderboard')
  const isAdmin = pathname.startsWith('/admin')
  const isProfile = pathname.startsWith('/profile')

  return (
    <nav className="sm:hidden fixed left-0 right-0 bottom-0 z-50 bg-paper/95 backdrop-blur-xl border-t border-border pb-[env(safe-area-inset-bottom)]">
      <div className={cn('grid px-2 py-1.5', role === 'admin' ? 'grid-cols-4' : 'grid-cols-3')}>
        <Link
          href="/board"
          className={cn(
            'flex flex-col items-center justify-center gap-1 py-1.5 text-[11px] transition-colors rounded-lg',
            isBoard ? 'text-ink bg-kinu/80' : 'text-ink-soft hover:text-ink'
          )}
        >
          <IoGridOutline className="w-4.5 h-4.5" />
          <span>Board</span>
        </Link>
        <Link
          href="/leaderboard"
          className={cn(
            'flex flex-col items-center justify-center gap-1 py-1.5 text-[11px] transition-colors rounded-lg',
            isLeaders ? 'text-ink bg-kinu/80' : 'text-ink-soft hover:text-ink'
          )}
        >
          <IoTrophyOutline className="w-4.5 h-4.5" />
          <span>Leaders</span>
        </Link>
        {role === 'admin' && (
          <Link
            href="/admin"
            className={cn(
              'flex flex-col items-center justify-center gap-1 py-1.5 text-[11px] transition-colors rounded-lg',
              isAdmin ? 'text-saffron bg-saffron-light/60' : 'text-saffron/80 hover:text-saffron'
            )}
          >
            <IoShieldCheckmarkOutline className="w-4.5 h-4.5" />
            <span>Admin</span>
          </Link>
        )}
        <Link
          href="/profile"
          className={cn(
            'flex flex-col items-center justify-center gap-1 py-1 text-[11px] transition-colors rounded-lg',
            isProfile ? 'text-ink bg-kinu/80' : 'text-ink-soft hover:text-ink'
          )}
        >
          <span className="w-5.5 h-5.5 rounded-full overflow-hidden border border-border-strong">
            <UserAvatar username={username ?? 'user'} size={22} />
          </span>
          <span>Avatar</span>
        </Link>
      </div>
    </nav>
  )
}