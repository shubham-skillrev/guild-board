'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ArrowRight } from '@phosphor-icons/react/dist/ssr'
import { Icon } from '@/components/ui/Icon'
import { useMeetLive } from '@/hooks/useMeetLive'

/**
 * "● LIVE · Guild meeting · <slide> · Join now →": a full-width saffron bar
 * across the site while this month's meeting is live
 * (docs/08-meeting-mode-v2.md). It's how people join: the whole bar opens
 * /meet. Hidden on /meet itself. A live rehearsal never shows it.
 *
 * The live state and the slide come from hooks/useMeetLive.ts (one poll of
 * GET /api/meet/live a minute, shared with board Kers).
 */
export function MeetingLiveBanner() {
  const { live, slide } = useMeetLive()
  const pathname = usePathname()
  if (!live || pathname === '/meet' || pathname?.startsWith('/meet/')) return null
  return <MeetingLiveBannerView slide={slide} />
}

/** The banner itself. */
export function MeetingLiveBannerView({ slide }: { slide?: string | null }) {
  return (
    <Link
      href="/meet"
      className="press block w-full bg-saffron text-parchment hover:bg-saffron/90 print:hidden"
      aria-label={`The guild meeting is live${slide ? `, now on ${slide}` : ''}. Join now`}
    >
      <span className="mx-auto flex h-10 w-full max-w-7xl items-center gap-2.5 px-5 text-footnote md:px-10">
        <span aria-hidden className="relative flex size-2 shrink-0">
          <span className="absolute inset-0 rounded-full bg-parchment opacity-70 motion-safe:animate-ping" />
          <span className="relative size-2 rounded-full bg-parchment" />
        </span>
        <span className="min-w-0 truncate">
          <span className="font-semibold tracking-[0.08em]">LIVE</span>
          <span aria-hidden className="opacity-70"> · </span>
          <span className="font-medium">Guild meeting</span>
          {slide && (
            <>
              <span aria-hidden className="opacity-70"> · </span>
              <span className="opacity-90">{slide}</span>
            </>
          )}
        </span>
        <span className="ml-auto flex shrink-0 items-center gap-1.5 font-medium">
          Join now <Icon icon={ArrowRight} size="sm" weight="bold" />
        </span>
      </span>
    </Link>
  )
}
