import type { LucideIcon } from 'lucide-react'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/utils/cn'

/**
 * Small status pill. Replaces the old Badge.
 *
 * Tones are deliberately few. Anything that is merely a label (a category, a
 * source) uses `neutral`; colour is reserved for state the reader should act
 * on or feel good about. Eight categories in eight colours is noise, not
 * information.
 */

type Tone = 'neutral' | 'accent' | 'success' | 'danger'

const TONES: Record<Tone, string> = {
  neutral: 'bg-fill text-label-2',
  accent: 'bg-accent-tint text-accent',
  success: 'bg-success-tint text-success',
  danger: 'bg-danger-tint text-danger',
}

interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
  icon?: LucideIcon
}

export function Chip({ tone = 'neutral', icon, className, children, ...props }: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-caption whitespace-nowrap',
        TONES[tone],
        className,
      )}
      {...props}
    >
      {icon && <Icon icon={icon} size="sm" />}
      {children}
    </span>
  )
}
