import { cn } from '@/lib/utils/cn'

type Tone = 'neutral' | 'saffron' | 'matcha' | 'indigo' | 'wisteria' | 'vermillion'

const TONES: Record<Tone, string> = {
  neutral: 'border-border text-cha',
  saffron: 'border-saffron/30 bg-saffron-light text-saffron',
  matcha: 'border-matcha/30 bg-matcha-light text-matcha',
  indigo: 'border-indigo-jp/30 bg-indigo-light text-indigo-jp',
  wisteria: 'border-wisteria/30 bg-wisteria-light text-wisteria',
  vermillion: 'border-vermillion/30 bg-vermillion-light text-vermillion',
}

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  tone?: Tone
}

/** Small status pill — categories, outcomes, counts. */
export function Badge({ tone = 'neutral', className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-[11px] font-medium whitespace-nowrap',
        TONES[tone],
        className,
      )}
      {...props}
    />
  )
}
