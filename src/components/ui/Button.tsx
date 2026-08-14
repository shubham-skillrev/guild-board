import type { LucideIcon } from 'lucide-react'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/utils/cn'

/**
 * The one button.
 *
 * Height comes from --control-h, so it is a 44px thumb target on a phone and a
 * tighter 36px on desktop without either being hardcoded here.
 *
 * Feedback is on pointer-down via `press`, not on click: waiting for the click
 * to acknowledge a tap is the single thing that makes a UI feel dead.
 */

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

const VARIANTS: Record<Variant, string> = {
  /* Saffron marks the one thing you can act on, so it stays rare.
     Label is parchment, not pure black: black on saffron is a harder edge than
     anything else in the product and it made the primary button shout.
     The glow is faint and warm, which is what gave the original its lift. */
  primary:
    'bg-saffron text-parchment font-semibold hover:bg-saffron/90 shadow-[0_0_20px_rgba(232,145,58,0.15)]',
  /* Outlined rather than a filled grey block. A secondary action that is also
     a solid slab competes with the primary instead of deferring to it. */
  secondary:
    'border border-border-strong text-ink-soft font-semibold hover:bg-kinu hover:text-ink',
  ghost: 'text-ink-soft hover:text-ink hover:bg-kinu',
  danger: 'text-vermillion hover:bg-vermillion-light',
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  /** Leading glyph. Decorative: the label carries the meaning. */
  icon?: LucideIcon
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
        'transition-colors disabled:opacity-40 disabled:pointer-events-none',
        /* 13px, matching the original. 14px on a 36px control reads chunky and
           was part of why the buttons stopped feeling considered. */
        size === 'md'
          ? 'h-(--control-h) px-3.5 text-footnote'
          : 'h-8 px-3 text-footnote',
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {icon && <Icon icon={icon} size={size === 'md' ? 'md' : 'sm'} />}
      {children}
    </button>
  )
}
