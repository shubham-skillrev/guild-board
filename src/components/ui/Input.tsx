import { cn } from '@/lib/utils/cn'

/* A hairline and a recessed fill, not an outline plus a glow ring. The ring was
   a second focus treatment fighting the one in globals.css, and border-strong
   made an empty form read as a stack of boxes before you typed anything. */
const FIELD =
  'w-full px-3 py-2 bg-sumi border border-border rounded-(--radius-control) text-footnote text-ink ' +
  'focus:outline-none focus:border-saffron/50 ' +
  'placeholder:text-ink-muted transition-colors'

const LABEL = 'block text-[11px] font-semibold text-ink-soft uppercase tracking-wider mb-1.5'

/** Field label matching the submit-modal treatment. */
export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn(LABEL, className)} {...props} />
}

/** Right-aligned character counter used under length-capped fields. */
export function CharCount({ value, max }: { value: string; max: number }) {
  return (
    <p className="text-[11px] text-cha mt-1 text-right tabular-nums">
      {value.length}/{max}
    </p>
  )
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(FIELD, className)} {...props} />
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(FIELD, 'font-mono resize-y', className)} {...props} />
}
