import { cn } from '@/lib/utils/cn'

type Tone = 'neutral' | 'saffron' | 'matcha' | 'indigo' | 'wisteria' | 'vermillion'

/**
 * Tint and text, no outline.
 *
 * A badge is a label on someone else's content, so it gets one visual device
 * rather than three. The bordered version read as a control - a small box with
 * an edge, sitting directly above a title, looks like something you press - and
 * a card carrying two of them looked like a toolbar before you read a word.
 *
 * The tints are alpha rather than the opaque `-light` ramp so a badge sits
 * correctly on a card, on a row and on a sheet without three variants.
 */
const TONES: Record<Tone, string> = {
  neutral: 'bg-fill text-ink-muted',
  saffron: 'bg-saffron/12 text-saffron',
  matcha: 'bg-matcha/12 text-matcha',
  indigo: 'bg-indigo-jp/12 text-indigo-jp',
  wisteria: 'bg-wisteria/12 text-wisteria',
  vermillion: 'bg-vermillion/12 text-vermillion',
}

const DOTS: Record<Tone, string> = {
  neutral: 'bg-ink-muted',
  saffron: 'bg-saffron',
  matcha: 'bg-matcha',
  indigo: 'bg-indigo-jp',
  wisteria: 'bg-wisteria',
  vermillion: 'bg-vermillion',
}

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
  /** Leading colour dot. For categories, where the hue is the fast read. */
  dot?: boolean
}

/** Small status pill - categories, outcomes, counts. */
export function Badge({ tone = 'neutral', dot = false, className, children, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap',
        TONES[tone],
        className,
      )}
      {...props}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full', DOTS[tone])} />}
      {children}
    </span>
  )
}
