import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

/**
 * The single icon surface for the app.
 *
 * Everything routes through here so stroke weight, size and colour cannot
 * drift between screens. Before this the app pulled from five different icon
 * sets plus emoji, each with its own grid and weight, which is a large part of
 * why pages did not look related to each other.
 *
 * Icons inherit `currentColor`, so colour is set by the parent's text colour
 * rather than passed in.
 */

type Size = 'sm' | 'md' | 'lg'

const SIZES: Record<Size, number> = {
  sm: 14,
  md: 16,
  lg: 20,
}

interface IconProps {
  icon: LucideIcon
  size?: Size
  className?: string
  /**
   * Screen-reader label. Omit for decorative icons that sit beside text, and
   * they will be hidden from assistive tech automatically.
   */
  label?: string
}

export function Icon({ icon: Glyph, size = 'md', className, label }: IconProps) {
  return (
    <Glyph
      size={SIZES[size]}
      // 1.5 reads correctly at UI sizes; Lucide's default 2 looks heavy below 20px.
      strokeWidth={1.5}
      className={cn('shrink-0', className)}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
    />
  )
}
