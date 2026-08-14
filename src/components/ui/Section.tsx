import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'
import { ArrowRight } from 'lucide-react'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/utils/cn'

/**
 * Page and section furniture.
 *
 * Pages compose these instead of hand-rolling a heading each time, which is
 * what stops screens drifting apart from one another. Labels are direct and
 * specific: a name that says what is in the list beats a safe generic one,
 * because specificity is what makes a screen predictable.
 */

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string
  subtitle?: string
  action?: React.ReactNode
}) {
  return (
    <header className="mb-7 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-title-1 text-label">{title}</h1>
        {subtitle && <p className="text-callout text-label-2 mt-1.5 max-w-prose">{subtitle}</p>}
      </div>
      {action && <div className="flex items-center gap-2 shrink-0 flex-wrap">{action}</div>}
    </header>
  )
}

export function SectionHeader({
  title,
  hint,
  href,
  hrefLabel = 'See all',
  id,
}: {
  title: string
  /** Short clarifier. Answers "what is this list" without a tooltip. */
  hint?: string
  href?: string
  hrefLabel?: string
  id?: string
}) {
  return (
    <div className="flex items-baseline gap-2 mb-3">
      <h2 id={id} className="text-title-3 text-label">
        {title}
      </h2>
      {hint && <span className="text-caption text-label-3">{hint}</span>}
      {href && (
        <Link
          href={href}
          className="press ml-auto shrink-0 inline-flex items-center gap-1 text-caption text-accent hover:underline"
        >
          {hrefLabel}
          <Icon icon={ArrowRight} size="sm" />
        </Link>
      )}
    </div>
  )
}

/**
 * A single number with its meaning attached. `tone` carries urgency, so the
 * strip reads at a glance: saffron means something is running out.
 */
export function StatTile({
  value,
  label,
  icon,
  tone = 'default',
  href,
}: {
  value: string | number
  label: string
  icon?: LucideIcon
  tone?: 'default' | 'active' | 'spent'
  href?: string
}) {
  /* Left aligned, so the tiles sit on the same vertical as the page header and
     the topic list rather than floating on their own centre axis.
     The number is explicitly sans: the title steps carry the display serif,
     which is right for headings and wrong for a figure you scan. */
  const body = (
    <>
      <div
        className={cn(
          'flex items-center gap-1.5',
          tone === 'active' ? 'text-accent' : 'text-ink-muted',
        )}
      >
        {icon && <Icon icon={icon} size="sm" />}
        <span className="text-meta truncate">{label}</span>
      </div>
      <div
        className={cn(
          'font-sans font-semibold tabular leading-none mt-2 text-[26px] tracking-tight',
          tone === 'active' && 'text-accent',
          tone === 'spent' && 'text-ink-muted',
          tone === 'default' && 'text-ink',
        )}
      >
        {value}
      </div>
    </>
  )

  /* A readout, not a control. Nothing here presses or hovers unless it is
     genuinely a link, because a tile that looks tappable and is not is worse
     than a plain panel. */
  const className = cn(
    'rounded-(--radius-card) border px-4 py-3.5 transition-colors',
    tone === 'active'
      ? 'border-saffron/25 bg-saffron-light'
      : 'border-border bg-paper/50',
    href && 'press hover:border-border-strong',
  )

  return href ? (
    <Link href={href} className={cn(className, 'block')}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  )
}

/** Consistent empty state. Says what goes here and what to do about it. */
export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon
  title: string
  body?: string
  action?: React.ReactNode
}) {
  return (
    <div className="text-center py-14">
      <div className="flex justify-center text-label-4 mb-3">
        <Icon icon={icon} size="lg" className="size-7" />
      </div>
      <p className="text-title-3 text-label-2">{title}</p>
      {body && <p className="text-callout text-label-3 mt-1.5 max-w-sm mx-auto">{body}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  )
}

/** Card-shaped skeleton. Matches the real card's rhythm so nothing jumps. */
export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-(--gap-list)" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="elev-1 rounded-(--radius-card) p-(--pad-card) animate-pulse-soft"
        >
          <div className="h-2.5 w-24 bg-fill rounded mb-3" />
          <div className="h-4 w-3/4 bg-fill-strong rounded mb-2.5" />
          <div className="h-3 w-full bg-fill rounded mb-1.5" />
          <div className="h-3 w-2/3 bg-fill rounded" />
        </div>
      ))}
    </div>
  )
}

/**
 * List row. Grouped lists are a strong native pattern: one surface, hairlines
 * between items, rather than a stack of separate floating cards.
 */
export function RowGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        'elev-1 rounded-(--radius-card) overflow-hidden divide-y divide-separator',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function Row({
  href,
  onClick,
  children,
  className,
}: {
  href?: string
  onClick?: () => void
  children: React.ReactNode
  className?: string
}) {
  const cls = cn(
    'flex items-center gap-3 px-(--pad-card) py-3 w-full text-left',
    'min-h-(--control-h) transition-colors',
    (href || onClick) && 'press hover:bg-fill',
    className,
  )

  if (href) {
    return (
      <Link href={href} className={cls}>
        {children}
      </Link>
    )
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls}>
        {children}
      </button>
    )
  }
  return <div className={cls}>{children}</div>
}
