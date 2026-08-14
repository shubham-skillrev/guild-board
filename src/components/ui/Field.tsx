import { cn } from '@/lib/utils/cn'

/**
 * Form field primitives.
 *
 * Inputs sit on a fill rather than a solid surface, so a form reads as recessed
 * into the card holding it instead of stacking another raised plane on top.
 */

const FIELD = [
  'w-full rounded-(--radius-control) bg-fill px-3 text-body text-label',
  'border border-transparent placeholder:text-label-4',
  'focus:outline-none focus:border-accent/50 focus:bg-fill-strong',
  'transition-colors',
].join(' ')

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return (
    <label
      className={cn('block text-caption uppercase tracking-wider text-label-3 mb-1.5', className)}
      {...props}
    />
  )
}

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(FIELD, 'h-(--control-h)', className)} {...props} />
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(FIELD, 'py-2.5 resize-y leading-relaxed', className)} {...props} />
}

/**
 * Character counter. Goes quiet until you are close to the cap, so it is not
 * nagging you through the whole of a short entry.
 */
export function CharCount({ value, max }: { value: string; max: number }) {
  const near = value.length > max * 0.8
  return (
    <p
      className={cn(
        'text-caption mt-1 text-right tabular transition-colors',
        near ? 'text-accent' : 'text-label-4',
      )}
    >
      {value.length}/{max}
    </p>
  )
}
