'use client'

import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowFatUp } from '@phosphor-icons/react/dist/ssr'
import { cn } from '@/lib/utils/cn'

/**
 * "Discuss this at the guild meet."
 *
 * The one signal the whole digest exists to collect, so it looks and behaves
 * identically wherever it appears - the same arrow and the same stacked count
 * as a topic on the board. It lived inline in ByteCard until the reader page
 * needed it too, and two copies of an optimistic toggle is two chances to fix
 * a bug once.
 */
export function InterestButton({
  byteId,
  initialCount,
  initialInterested,
  layout = 'stacked',
}: {
  byteId: string
  initialCount: number
  initialInterested: boolean
  /** `stacked` for a list row, `wide` for the reader, where it is the CTA. */
  layout?: 'stacked' | 'wide'
}) {
  const reduceMotion = useReducedMotion()
  const [interested, setInterested] = useState(initialInterested)
  const [count, setCount] = useState(initialCount)
  const [busy, setBusy] = useState(false)

  const toggle = async () => {
    if (busy) return
    setBusy(true)

    // Optimistic: the tap has to register instantly or the whole affordance
    // reads as broken.
    const was = interested
    setInterested(!was)
    setCount(c => Math.max(0, c + (was ? -1 : 1)))

    try {
      const res = await fetch('/api/byte-interests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ byte_id: byteId }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setInterested(was)
      setCount(c => Math.max(0, c + (was ? 1 : -1)))
    } finally {
      setBusy(false)
    }
  }

  /* The number shows even at zero: a visible 0 is an invitation, a hidden one
     is a control nobody notices. Warm before you have tapped when someone else
     already has, because that is a signal worth carrying colour. */
  const tone = interested
    ? 'border-saffron/50 bg-saffron/15 text-saffron'
    : count > 0
      ? 'border-saffron/25 text-saffron hover:bg-saffron/12'
      : 'border-border text-ink-muted hover:border-saffron/45 hover:text-saffron hover:bg-saffron/10'

  return (
    <motion.button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={interested}
      aria-label={interested ? 'Remove your upvote' : 'Upvote to discuss this at the guild meet'}
      title={interested ? 'On the agenda list' : 'Discuss this at the guild meet'}
      whileTap={reduceMotion ? undefined : { scale: 0.94 }}
      transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
      className={cn(
        'shrink-0 rounded-(--radius-control) border transition-colors disabled:opacity-60',
        layout === 'stacked'
          ? 'self-start flex flex-col items-center justify-center gap-0.5 w-11 h-12'
          : 'inline-flex items-center gap-2 h-(--control-h) px-4',
        tone,
      )}
    >
      <ArrowFatUp className="w-4.5 h-4.5" weight={interested ? 'fill' : 'regular'} />
      {layout === 'wide' && (
        <span className="text-footnote">
          {interested ? 'On the agenda' : 'Discuss at the meet'}
        </span>
      )}
      <span className="text-footnote font-bold tabular leading-none">{count}</span>
    </motion.button>
  )
}
