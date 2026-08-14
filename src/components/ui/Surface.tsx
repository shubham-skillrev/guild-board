import { cn } from '@/lib/utils/cn'

/**
 * The elevation primitive. Everything with a background uses this so the
 * layering stays consistent instead of each component inventing its own
 * background/border pair.
 *
 * Level maps to the elevation model: 1 is a card sitting on the page, 2 is a
 * sheet over content, 3 is a menu over a sheet. Higher levels are lighter and
 * cast more, which is what carries depth in a dark UI.
 */

type Level = 1 | 2 | 3

const LEVELS: Record<Level, string> = {
  1: 'elev-1',
  2: 'elev-2',
  3: 'elev-3',
}

interface SurfaceProps extends React.HTMLAttributes<HTMLElement> {
  level?: Level
  /** Adds hover affordance. Only for surfaces that are actually clickable. */
  interactive?: boolean
  /** Semantic tag. `article` for a standalone card, `li` inside a list. */
  as?: 'div' | 'article' | 'section' | 'li'
}

export function Surface({
  level = 1,
  interactive = false,
  as: Tag = 'div',
  className,
  ...props
}: SurfaceProps) {
  return (
    <Tag
      className={cn(
        LEVELS[level],
        'rounded-(--radius-card)',
        interactive && 'press transition-colors hover:border-white/20',
        className,
      )}
      {...props}
    />
  )
}
