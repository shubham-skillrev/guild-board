'use client'

import { useState } from 'react'

interface Props {
  toUserId: string
  cycleId: string
  alreadyGiven: boolean  // current user sparked this specific person
  isDisabled: boolean    // current user already sparked someone else
}

export function SparkButton({ toUserId, cycleId, alreadyGiven, isDisabled }: Props) {
  const [given, setGiven] = useState(alreadyGiven)
  const [loading, setLoading] = useState(false)

  if (given) {
    return <span className="text-saffron text-[12px] font-semibold">⚡ Sparked</span>
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
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleSpark}
      disabled={loading}
      className="text-[12px] px-2 py-0.5 rounded border border-saffron/50 text-saffron hover:bg-saffron/10 active:scale-95 transition-all disabled:opacity-50 cursor-pointer"
    >
      {loading ? '…' : '⚡ Give'}
    </button>
  )
}
