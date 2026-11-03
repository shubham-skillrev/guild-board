import Link from 'next/link'
import { ArrowRight } from '@phosphor-icons/react/dist/ssr'
import { Icon } from '@/components/ui/Icon'

export interface ActionNote {
  id: string
  text: string
  href: string
}

/* Pinned slightly askew, like notes on a real board. Static, so nothing
   moves for anyone who asked for less motion. */
const TILT = ['sm:-rotate-[0.6deg]', 'sm:rotate-[0.5deg]', 'sm:-rotate-[0.3deg]', 'sm:rotate-[0.7deg]']

/** This week's to-dos as notes on Kers' desk. Each one goes where it's done. */
export function ActionNotes({ notes }: { notes: ActionNote[] }) {
  if (!notes.length) {
    return <p className="text-footnote text-ink-muted">Nothing on the desk. Suspiciously calm.</p>
  }
  return (
    <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {notes.map((n, i) => (
        <li key={n.id} className={TILT[i % TILT.length]}>
          <Link
            href={n.href}
            className="press group relative block h-full rounded-[14px] border border-saffron/20 bg-[color-mix(in_oklab,var(--color-saffron)_7%,var(--color-paper))] px-4 pb-4 pt-5 shadow-[0_6px_18px_var(--shadow-tint)] transition-transform hover:-translate-y-0.5"
          >
            {/* A strip of tape. */}
            <span aria-hidden className="absolute -top-2 left-1/2 h-4 w-14 -translate-x-1/2 rotate-[-2deg] rounded-[3px] bg-kinu/80 shadow-sm" />
            <span className="font-mono text-[11px] text-cha tabular">{String(i + 1).padStart(2, '0')}</span>
            <span className="mt-1 block text-footnote leading-relaxed text-ink">{n.text}</span>
            <span className="mt-3 inline-flex items-center gap-1 text-meta text-saffron group-hover:underline">
              Do it <Icon icon={ArrowRight} size="sm" />
            </span>
          </Link>
        </li>
      ))}
    </ol>
  )
}
