'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils/cn'
import { useToast } from '@/hooks/useToast'

/**
 * One on/off setting on the profile, saved the moment it flips (and flipped
 * back if the save fails). `endpoint` takes a PATCH of `{ [field]: boolean }`.
 */
export function ProfileSwitch({
  initial,
  endpoint,
  field,
  label,
  hint,
  className,
}: {
  initial: boolean
  endpoint: string
  field: string
  label: string
  hint: React.ReactNode
  className?: string
}) {
  const [on, setOn] = useState(initial)
  const [pending, setPending] = useState(false)
  const toast = useToast()

  const flip = async () => {
    if (pending) return
    const next = !on
    setOn(next)
    setPending(true)
    try {
      const res = await fetch(endpoint, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: next }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setOn(!next)
      toast('Could not save that. Try again.', 'error')
    } finally {
      setPending(false)
    }
  }

  return (
    <label className={cn('flex items-start gap-3 cursor-pointer select-none', className)}>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={flip}
        disabled={pending}
        className={cn('relative mt-0.5 shrink-0 w-8 h-4.5 rounded-full transition-colors', on ? 'bg-ink' : 'bg-border-strong')}
      >
        <span className={cn('absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-paper transition-transform', on && 'translate-x-3.5')} />
        <span className="sr-only">{label}</span>
      </button>
      <span className="min-w-0">
        <span className="block text-[13px] text-ink">{label}</span>
        <span className="block text-[12px] text-cha mt-0.5 leading-relaxed">{hint}</span>
      </span>
    </label>
  )
}
