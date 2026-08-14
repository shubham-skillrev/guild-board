import { cn } from '@/lib/utils/cn'

const FIELD =
  'w-full px-3 py-2 bg-sumi border border-border-strong rounded-lg text-sm text-ink ' +
  'focus:outline-none focus:ring-2 focus:ring-saffron/30 focus:border-saffron/50 ' +
  'placeholder:text-cha transition-all'

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
