'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { SubmitModal } from '@/components/topics/SubmitModal'
import type { Cycle } from '@/types'

/**
 * Arriving from the landing page's "Share a problem" (?share=1) opens the form
 * once, as soon as the member can post. It waits for username setup, which
 * strips its own param and leaves this one in place.
 *
 * Its own component because `useSearchParams` needs a Suspense boundary, and
 * wrapping only this keeps the rest of the board prerendered.
 */
export function ShareIntent({
  cycle,
  canShare,
  onSubmitted,
}: {
  cycle: Cycle | null
  canShare: boolean
  onSubmitted: () => void
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [handled, setHandled] = useState(false)

  const wanted =
    !handled &&
    searchParams.get('share') === '1' &&
    searchParams.get('setup') !== 'username'
  if (!wanted || !canShare || !cycle) return null

  const done = () => {
    setHandled(true)
    router.replace('/board', { scroll: false })
  }

  return (
    <SubmitModal
      cycle={cycle}
      onClose={done}
      onSubmitted={() => { done(); onSubmitted() }}
    />
  )
}
