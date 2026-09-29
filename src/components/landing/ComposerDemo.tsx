'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { KINDS } from '@/lib/kinds'
import { KindChips } from '@/components/topics/KindChips'

/**
 * The hero's one moment: the real share form, filled in, cycling through the
 * five kinds of thing people bring. It says "anything worth talking about"
 * without a feature list, and the first time someone opens the real form it
 * is already familiar, because these are the same chips, questions and
 * examples (all from src/lib/kinds.ts).
 *
 * Starts on Problem on the server and the client alike, so hydration matches.
 * Pauses on hover and while the tab is hidden. With reduced motion it stays on
 * the first kind and nothing changes.
 */
const INTERVAL_MS = 3400

export function ComposerDemo() {
  const reduce = useReducedMotion()
  const [index, setIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const kind = KINDS[index]

  useEffect(() => {
    if (reduce || paused) return
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') setIndex(i => (i + 1) % KINDS.length)
    }, INTERVAL_MS)
    return () => clearInterval(id)
  }, [reduce, paused])

  const fade = {
    initial: { opacity: 0, y: 4 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -4 },
    transition: { duration: 0.25, ease: [0.22, 1, 0.36, 1] as const },
  }

  return (
    <div
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      className="w-full rounded-(--radius-card) border border-border bg-paper shadow-[0_24px_60px_-28px_var(--shadow-tint-strong)]"
      role="img"
      aria-label="The GuildBoard share form, showing the five kinds of thing people bring: a problem, something learned, new tech, a take, or something they built."
    >
      <div aria-hidden>
        <div className="flex items-center justify-between px-5 pt-5">
          <AnimatePresence mode="wait" initial={false}>
            <motion.p key={kind.value} className="text-[15px] font-semibold tracking-[-0.01em] text-ink" {...fade}>
              {kind.heading}
            </motion.p>
          </AnimatePresence>
          <span className="eyebrow">new discussion</span>
        </div>

        <div className="px-5 pt-4">
          <KindChips value={kind.value} />
        </div>

        <div className="px-5 py-5 space-y-4">
          <DemoField label={kind.first.label} value={kind.first.example} k={`${kind.value}-1`} fade={fade} strong />
          <DemoField label={kind.second.label} value={kind.second.example} k={`${kind.value}-2`} fade={fade} />
        </div>

        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-border">
          <AnimatePresence mode="wait" initial={false}>
            <motion.span
              key={kind.value}
              className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full bg-saffron-light text-saffron text-[12px] font-medium"
              {...fade}
            >
              <span className="font-mono tabular-nums">{6 - (index % 3)}</span> · {kind.reaction.idle}
            </motion.span>
          </AnimatePresence>
          <span className="inline-flex items-center h-8 px-4 rounded-full bg-ink text-parchment text-[13px] font-medium">
            Post
          </span>
        </div>
      </div>
    </div>
  )
}

function DemoField({ label, value, k, fade, strong }: {
  label: string
  value: string
  k: string
  fade: Record<string, unknown>
  strong?: boolean
}) {
  return (
    <div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p key={`${k}-l`} className="text-[12px] font-medium text-ink-soft mb-1.5" {...fade}>
          {label}
        </motion.p>
      </AnimatePresence>
      <div className="min-h-11 px-3.5 py-2.5 rounded-(--radius-control) bg-sumi">
        <AnimatePresence mode="wait" initial={false}>
          <motion.p
            key={`${k}-v`}
            className={strong ? 'text-[14px] font-medium text-ink leading-snug' : 'text-[13px] text-ink-soft leading-relaxed'}
            {...fade}
          >
            {value}
          </motion.p>
        </AnimatePresence>
      </div>
    </div>
  )
}
