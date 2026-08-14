import type { Icon as PhosphorIcon } from '@phosphor-icons/react'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/utils/cn'

/**
 * The one button.
 *
 * Sizing is deliberate rather than inherited. `--control-h` is 44px on touch,
 * which is correct for a bare tap target but too tall for a labelled button
 * sitting next to body text: it made "Put on board" read as a slab. Buttons set
 * their own height and reach the 44px touch floor through padding on coarse
 * pointers instead, so the target stays honest without the box growing.
 *
 * Emphasis is the thing this file is really controlling, and the rule is that a
 * button is never the loudest element in its own container. A card's title is
 * the content; the buttons under it are how you act on it, so they sit a step
 * quieter. In practice that means:
 *
 *   primary    one per screen, at most. Solid saffron is a claim, not a style.
 *   tinted     the main action inside a card or a row. Reads as accent without
 *              putting a filled block under every title.
 *   secondary  a quiet fill rather than an outline. Three outlined buttons in a
 *              row turn into a toolbar, which is what made these look heavy.
 *   ghost      no chrome at rest. Tertiary actions earn their box on hover.
 *
 * Feedback is on pointer-down via `press`, not on click: waiting for the click
 * to acknowledge a tap is the single thing that makes a UI feel dead.
 */

type Variant = 'primary' | 'tinted' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

const VARIANTS: Record<Variant, string> = {
  /* Saffron marks the one thing you can act on, so it stays rare. Parchment
     label rather than black: black on saffron is a harder edge than anything
     else in the product.
     No glow. A drop shadow on a filled accent button adds bulk without adding
     information, and it was making the primary look inflated next to its
     neighbours. */
  primary:
    'bg-saffron text-parchment hover:bg-saffron/90 shadow-[0_0_20px_rgba(232,145,58,0.15)]',
  /* Accent colour, no fill weight. This is what most "primary" actions in the
     product actually want: the row still reads as text with one warm word in
     it, rather than as a stack of orange blocks. */
  tinted: 'bg-saffron/12 text-saffron hover:bg-saffron/20',
  /* A fill, not an outline. At 28-32px a hairline box reads as a second filled
     button sitting next to the first; a barely-lifted surface recedes. */
  secondary: 'bg-kinu/70 text-ink-soft hover:bg-kinu hover:text-ink',
  /* No chrome at rest. Tertiary actions like Delete earn their box on hover. */
  ghost: 'text-ink-muted hover:text-ink hover:bg-kinu/60',
  danger: 'text-vermillion hover:bg-vermillion-light',
}

/* Two heights on a pointer, one on a thumb.
   The desktop sizes are what keep a row of actions from reading as a slab. The
   coarse-pointer sizes ignore that entirely and go to the 44px tap floor,
   because a 26px target is not a target on a phone - it is a coin toss. This is
   the one place the two pointer types genuinely want different numbers. */
const SIZES: Record<Size, string> = {
  md: 'h-8 px-3 text-footnote pointer-coarse:h-11 pointer-coarse:px-4',
  sm: 'h-6.5 px-2.5 text-[12px] pointer-coarse:h-10 pointer-coarse:px-3.5 pointer-coarse:text-footnote',
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  /** Leading glyph. Decorative: the label carries the meaning. */
  icon?: PhosphorIcon
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  className,
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'press inline-flex items-center justify-center gap-1.5 rounded-(--radius-control)',
        'font-medium whitespace-nowrap',
        'transition-colors disabled:opacity-40 disabled:pointer-events-none',
        SIZES[size],
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {icon && <Icon icon={icon} size="sm" />}
      {children}
    </button>
  )
}
