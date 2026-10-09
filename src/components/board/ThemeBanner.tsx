import { AccentTitle } from '@/components/ui/AccentTitle'
import type { CycleTheme } from '@/lib/themes'

/**
 * The month's theme, as one pill under the board title.
 *
 * Just the label and the theme's headline: the full pitch lives on the
 * landing page, and here a reminder is enough. The tint is the board's one
 * warm surface, so it is seen first without competing with the list.
 * A plain month has no theme and no pill.
 */
export function ThemeBanner({ theme }: { theme: CycleTheme }) {
  return (
    <p className="mt-3 inline-flex max-w-full items-center gap-2 rounded-full border border-saffron/25 bg-saffron-light py-1 pl-2.5 pr-3.5">
      <span className="eyebrow text-saffron! shrink-0">Theme</span>
      <span aria-hidden className="h-3 w-px shrink-0 bg-saffron/30" />
      <span className="truncate text-footnote font-semibold text-label">
        <AccentTitle title={theme.title} accent={theme.accent} />
      </span>
    </p>
  )
}
