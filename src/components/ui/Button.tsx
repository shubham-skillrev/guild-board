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
  // Saffron marks the one thing you can act on, so it stays rare.
  primary: 'bg-accent text-black font-semibold hover:bg-accent/90',
  secondary: 'bg-fill text-label hover:bg-fill-strong',
  ghost: 'text-label-2 hover:text-label hover:bg-fill',
  danger: 'text-danger hover:bg-danger-tint',
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
        size === 'md'
          ? 'h-(--control-h) px-4 text-callout font-medium'
          : 'h-8 px-3 text-footnote font-medium',
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
