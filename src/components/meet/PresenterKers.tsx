'use client'

import { useEffect, useRef, useState } from 'react'
import { Kers, type KersEyes, type KersMotion } from '@/components/kers/Kers'
import type { KersColour } from '@/components/kers/look'
import type { Expression } from '@guildboard/guildbot'
import { cn } from '@/lib/utils/cn'
import { BOSS_LINE, type BossPhase } from '@/lib/meet/boss'

const CHEER_MS = 3200

const CHEERS = ['Done. Next.', 'That one went well. Mostly.', 'Moving on, like professionals.', 'Segment survived.', 'Good. Keep going.']

interface Mood {
  expression: Expression
  colour: KersColour
  motion: KersMotion
  special: KersEyes
  line: string | null
}

/**
 * Kers, small, in the corner of the presenter screen. Most of the time he
 * just sits there. He says something only now and then, in a bubble that
 * comes and goes: a cheer (a hop, happy eyes) when the presenter moves on,
 * his dare while a Boss Round's intro is on, and a reaction once it's closed
 * (the verdict itself is on the stage). Nothing he says names anyone, and
 * nothing he does is about time: the meeting goes at the presenter's pace.
 */
export function PresenterKers({
  segmentKey,
  live,
  ended,
  boss,
  className,
}: {
  /** Changes when the presenter moves on: that's his cue to cheer. */
  segmentKey: string | null
  live: boolean
  ended: boolean
  /** The current segment's Boss Round, if it's on (lib/meet/boss.ts bossPhase). */
  boss?: BossPhase | null
  className?: string
}) {
  const [cheer, setCheer] = useState<number | null>(null)
  const first = useRef(segmentKey)

  useEffect(() => {
    if (segmentKey === first.current) return
    first.current = segmentKey
    if (!live) return
    const n = Math.floor(Math.random() * CHEERS.length)
    const on = setTimeout(() => setCheer(n), 0)
    const off = setTimeout(() => setCheer(null), CHEER_MS)
    return () => {
      clearTimeout(on)
      clearTimeout(off)
    }
  }, [segmentKey, live])

  let mood: Mood
  if (ended) mood = { expression: 'proud', colour: 'proud', motion: 'idle', special: null, line: 'That’s the hour. The recap is on the Run tab.' }
  else if (!live) mood = { expression: 'excited', colour: 'meeting', motion: 'idle', special: null, line: 'Ready when you are.' }
  else if (boss?.phase === 'intro') mood = { expression: 'smug', colour: 'smug', motion: 'hop', special: null, line: BOSS_LINE }
  else if (boss?.phase === 'verdict') mood = verdictMood(boss.pct, boss.trying)
  else if (cheer !== null) mood = { expression: 'excited', colour: 'proud', motion: 'hop', special: 'happy', line: CHEERS[cheer] }
  else if (boss?.phase === 'running') mood = { expression: 'nosy', colour: 'meeting', motion: 'idle', special: null, line: null }
  else mood = { expression: 'smug', colour: 'smug', motion: 'idle', special: null, line: null }

  return (
    <div className={cn('relative', className)}>
      <p
        aria-live="polite"
        className={cn(
          'pointer-events-none absolute bottom-full right-2 mb-1 w-max max-w-[24rem] origin-bottom-right rounded-2xl rounded-br-md border border-border bg-sumi px-4 py-2.5 text-[17px] leading-snug text-ink shadow-[0_8px_24px_var(--shadow-tint)]',
          'transition-[opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-opacity',
          mood.line ? 'translate-y-0 scale-100 opacity-100' : 'translate-y-1 scale-95 opacity-0',
        )}
      >
        {mood.line ?? '\u00a0'}
      </p>
      <Kers size={60} expression={mood.expression} colour={mood.colour} motion={mood.motion} special={mood.special} />
    </div>
  )
}

/** How he takes the verdict; the line is on the stage, so the bubble stays quiet. */
function verdictMood(pct: number, trying: number): Mood {
  if (trying === 0) return { expression: 'bored', colour: 'bored', motion: 'still', special: null, line: null }
  if (pct >= 75) return { expression: 'proud', colour: 'proud', motion: 'hop', special: 'happy', line: null }
  if (pct >= 25) return { expression: 'smug', colour: 'smug', motion: 'idle', special: null, line: null }
  return { expression: 'dramatic', colour: 'dramatic', motion: 'idle', special: null, line: null }
}
