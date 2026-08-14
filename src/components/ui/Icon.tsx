import type { Icon as PhosphorIcon, IconWeight } from '@phosphor-icons/react'
import { cn } from '@/lib/utils/cn'

/**
 * The single icon surface for the app.
 *
 * Everything routes through here so weight, size and colour cannot drift
 * between screens. Before this the app pulled from five react-icons sets plus
 * Lucide plus ~25 emoji, each with its own grid and weight, which is a large
 * part of why pages did not look related to each other.
 *
 * Phosphor rather than Lucide, for two reasons that both came up in practice:
 * roughly 3000 glyphs instead of 1600, so concepts like "raise hand" or
 * "question" have a real icon instead of an emoji standing in for one; and a
 * `weight` axis that includes duotone, which is how an icon carries two tones
 * without hand-drawing a second layer.
 *
 * Icons inherit `currentColor`, so colour is set by the parent's text colour
 * rather than passed in. Duotone additionally paints its secondary shape at a
 * fraction of that same colour, so a tinted icon stays in one hue family
 * rather than becoming a second palette.
 */

type Size = 'sm' | 'md' | 'lg'

const SIZES: Record<Size, number> = {
  sm: 14,
  md: 16,
  lg: 20,
}

interface IconProps {
  icon: PhosphorIcon
  size?: Size
  /**
   * `duotone` is for icons that carry identity, where the second tone does the
   * differentiating. Everything structural stays `regular`.
   */
  weight?: IconWeight
  className?: string
  /**
   * Screen-reader label. Omit for decorative icons that sit beside text, and
   * they will be hidden from assistive tech automatically.
   */
  label?: string
}

export function Icon({ icon: Glyph, size = 'md', weight = 'regular', className, label }: IconProps) {
  return (
    <Glyph
      size={SIZES[size]}
      weight={weight}
      className={cn('shrink-0', className)}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      role={label ? 'img' : undefined}
    />
  )
}
