import { cn } from '@/lib/utils/cn'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-saffron text-parchment hover:bg-saffron/90',
  secondary: 'border border-border-strong text-ink-soft hover:bg-kinu',
  ghost: 'text-cha hover:text-ink hover:bg-kinu',
  danger: 'border border-vermillion/30 text-vermillion hover:bg-vermillion-light',
}

const SIZES: Record<Size, string> = {
  sm: 'px-3 py-1.5 text-[12px]',
  md: 'px-5 py-2.5 text-[13px]',
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
}

/**
 * Shared button. Extracted from the three hand-rolled implementations in
 * SubmitModal / TopicCard / CommentThread so new surfaces stop re-deriving
 * the same class strings.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  className,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'rounded-lg font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  )
}
