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
  const [confirming, setConfirming] = useState(false)
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
    setConfirming(false)
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
    <>
      <button
        ref={btnRef}
        onClick={() => setConfirming(true)}
        disabled={loading}
        className="text-[12px] px-2 py-0.5 rounded border border-saffron/50 text-saffron hover:bg-saffron/10 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
      >
        {loading ? '…' : '⚡ Give'}
      </button>

      {confirming && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setConfirming(false)}
        >
          <div
            className="relative bg-paper border border-saffron/30 rounded-2xl p-6 max-w-sm w-[90vw] shadow-[0_32px_80px_rgba(0,0,0,0.5)] text-center"
            onClick={e => e.stopPropagation()}
          >
            <div className="text-4xl mb-3">⚡</div>
            <h3 className="font-serif text-lg text-ink mb-1">Choose wisely.</h3>
            <p className="text-[13px] text-ink-soft mb-5 leading-relaxed">
              You only get <span className="text-saffron font-semibold">one spark per cycle</span>. Once given, it&apos;s gone. Make it count — who truly inspired the guild this month?
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={() => setConfirming(false)}
                className="px-4 py-1.5 rounded-lg border border-border text-ink-soft text-[13px] hover:bg-border/40 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                onClick={handleSpark}
                className="px-4 py-1.5 rounded-lg bg-saffron text-paper text-[13px] font-semibold hover:bg-saffron/90 active:scale-95 transition-all cursor-pointer"
              >
                ⚡ Yes, spark them!
              </button>
            </div>
          </div>
        </div>
      )}
    </>
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
