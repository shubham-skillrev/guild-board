import { cn } from '@/lib/utils/cn'

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Adds hover affordance - use for cards that are links or buttons. */
  interactive?: boolean
}

/** Surface container matching the board's card treatment. */
export function Card({ interactive = false, className, ...props }: CardProps) {
  return (
    <div
      className={cn(
        'bg-paper/50 border border-border rounded-xl',
        interactive && 'transition-colors hover:bg-kinu/30 hover:border-border-strong',
        className,
      )}
      {...props}
    />
  )
}
