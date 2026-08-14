import Link from 'next/link'
import { cn } from '@/lib/utils/cn'

/**
 * Shared page and section furniture.
 *
 * Hierarchy comes from weight, size and leading together rather than size
 * alone, so these wrap the type scale instead of letting every page invent its
 * own heading treatment. Labels are direct and specific: "Top right now" beats
 * "Featured", because specificity is what makes a screen predictable.
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
        <h1 className="type-display font-serif text-ink">{title}</h1>
        {subtitle && <p className="type-body text-ink-soft mt-1.5">{subtitle}</p>}
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
      <h2 id={id} className="type-title text-ink">
        {title}
      </h2>
      {hint && <span className="type-caption text-cha">{hint}</span>}
      {href && (
        <Link href={href} className="type-caption text-saffron hover:underline ml-auto press shrink-0">
          {hrefLabel} →
        </Link>
      )}
    </div>
  )
}

/**
 * A single number with its meaning attached. Used for the cycle status strip.
 * `tone` carries urgency: saffron when something is running out.
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
  icon?: string
  tone?: 'default' | 'active' | 'spent'
  href?: string
}) {
  const body = (
    <>
      {icon && (
        <div className="text-base mb-1 leading-none" aria-hidden>
          {icon}
        </div>
      )}
      <div
        className={cn(
          'text-[20px] font-semibold tabular leading-none',
          tone === 'active' && 'text-saffron',
          tone === 'spent' && 'text-cha',
          tone === 'default' && 'text-ink',
        )}
      >
        {value}
      </div>
      <div className="type-caption text-cha mt-1.5">{label}</div>
    </>
  )

  const className = cn(
    'rounded-xl border px-3 py-3.5 text-center transition-colors',
    tone === 'active' ? 'border-saffron/25 bg-saffron-light/30' : 'border-border bg-paper/40',
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
  icon: string
  title: string
  body?: string
  action?: React.ReactNode
}) {
  return (
    <div className="text-center py-16">
      <div className="text-3xl mb-3" aria-hidden>
        {icon}
      </div>
      <p className="type-title text-ink-soft">{title}</p>
      {body && <p className="type-body text-cha mt-1.5 max-w-sm mx-auto">{body}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  )
}

/** Card-shaped skeleton. Matches the real card's rhythm so nothing jumps. */
export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="rounded-2xl border border-border bg-paper/40 p-4">
          <div className="h-2.5 w-24 bg-kinu/60 rounded mb-3" />
          <div className="h-4 w-3/4 bg-kinu/70 rounded mb-2.5" />
          <div className="h-3 w-full bg-kinu/40 rounded mb-1.5" />
          <div className="h-3 w-2/3 bg-kinu/40 rounded" />
        </div>
      ))}
    </div>
  )
}
