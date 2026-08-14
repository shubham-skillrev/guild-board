'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lightning } from '@phosphor-icons/react/dist/ssr'
import { Portal } from '@/components/ui/Portal'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'

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
  const router = useRouter()

  if (given) {
    return (
      <span className="relative inline-flex items-center gap-1 text-saffron text-[12px] font-medium">
        <Icon icon={Lightning} size="sm" weight="fill" />
        Sparked
        {showCelebration && <SparkCelebration onDone={() => setShowCelebration(false)} />}
      </span>
    )
  }

  if (isDisabled) {
    return <span className="text-cha text-[12px]">-</span>
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
      <Button
        size="sm"
        variant="tinted"
        icon={Lightning}
        onClick={() => setConfirming(true)}
        disabled={loading}
      >
        {loading ? '…' : 'Give a spark'}
      </Button>

      {confirming && (
        <Portal>
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setConfirming(false)}
        >
          <div
            className="relative elev-3 rounded-(--radius-card) p-6 max-w-sm w-[90vw] text-center"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex justify-center text-saffron mb-3">
              <Icon icon={Lightning} size="lg" weight="duotone" className="size-7" />
            </div>
            <h3 className="text-title-2 text-ink mb-1">Choose wisely.</h3>
            <p className="text-[13px] text-ink-soft mb-5 leading-relaxed">
              You only get <span className="text-saffron font-semibold">one spark per cycle</span>. Once given, it&apos;s gone. Make it count - who truly inspired the guild this month?
            </p>
            <div className="flex gap-2 justify-center">
              <Button variant="ghost" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
              <Button icon={Lightning} onClick={handleSpark}>
                Yes, spark them
              </Button>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </>
  )
}

/** Spark celebration - animated particles burst + glow */
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
