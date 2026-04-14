'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  toUserId: string
  cycleId: string
  alreadyGiven: boolean  // current user sparked this specific person
  isDisabled: boolean    // current user already sparked someone else
  onSpark?: () => void   // callback after successful spark
}

export function SparkButton({ toUserId, cycleId, alreadyGiven, isDisabled, onSpark }: Props) {
  const [given, setGiven] = useState(alreadyGiven)
  const [loading, setLoading] = useState(false)
  const [showCelebration, setShowCelebration] = useState(false)
  const btnRef = useRef<HTMLButtonElement>(null)
  const router = useRouter()

  if (given) {
    return (
      <span className="relative text-saffron text-[12px] font-semibold">
        ⚡ Sparked
        {showCelebration && <SparkCelebration onDone={() => setShowCelebration(false)} />}
      </span>
    )
  }

  if (isDisabled) {
    return <span className="text-cha text-[12px]">—</span>
  }

  async function handleSpark() {
    setLoading(true)
    try {
      const res = await fetch('/api/sparks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to_user_id: toUserId, cycle_id: cycleId }),
      })
      if (res.ok || res.status === 409) {
        setGiven(true)
        setShowCelebration(true)
        onSpark?.()
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      ref={btnRef}
      onClick={handleSpark}
      disabled={loading}
      className="text-[12px] px-2 py-0.5 rounded border border-saffron/50 text-saffron hover:bg-saffron/10 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
    >
      {loading ? '…' : '⚡ Give'}
    </button>
  )
}

/** Spark celebration — animated particles burst + glow */
function SparkCelebration({ onDone }: { onDone: () => void }) {
  return (
    <span
      className="absolute inset-0 pointer-events-none flex items-center justify-center"
      onAnimationEnd={onDone}
    >
      {/* Central flash */}
      <span className="absolute w-8 h-8 rounded-full bg-saffron/40 animate-spark-flash" />
      {/* Radiating particles */}
      {[...Array(8)].map((_, i) => (
        <span
          key={i}
          className="absolute w-1.5 h-1.5 rounded-full bg-saffron animate-spark-particle"
          style={{
            '--spark-angle': `${i * 45}deg`,
          } as React.CSSProperties}
        />
      ))}
    </span>
  )
}
