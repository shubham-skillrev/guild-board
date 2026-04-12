'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils/cn'

interface ContribButtonProps {
  topicId: string
  cycleId: string
  count: number
  hasContributed: boolean
  disabled: boolean
  onContrib: (topicId: string, cycleId: string, hasContributed: boolean) => Promise<void>
}

export function ContribButton({ topicId, cycleId, count, hasContributed, disabled, onContrib }: ContribButtonProps) {
  const [isPending, setIsPending] = useState(false)

  const handleClick = async () => {
    if (isPending || disabled) return
    setIsPending(true)
    try {
      await onContrib(topicId, cycleId, hasContributed)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending || disabled}
      aria-label={hasContributed ? "Withdraw from discussion" : "I'm in — I'll discuss this"}
      className={cn(
        'flex items-center justify-center gap-1 w-14 h-8 rounded-lg border text-[12px] font-medium transition-all',
        hasContributed
          ? 'bg-matcha/10 border-matcha/30 text-matcha hover:bg-matcha/15'
          : 'bg-paper border-border text-ink-soft hover:border-border-strong hover:text-ink hover:bg-kinu/30',
        (isPending || disabled) && 'opacity-40 cursor-not-allowed'
      )}
    >
      <span>🤝</span>
      <span className="tabular-nums">{count}</span>
    </button>
  )
}
