'use client'

import { useEffect, useRef, useState } from 'react'
import { Kers, type KersEyes, type KersMotion } from '@/components/kers/Kers'
import type { KersColour } from '@/components/kers/look'
import type { Expression } from '@guildboard/guildbot'
import { cn } from '@/lib/utils/cn'
import { BOSS_LINE, bossVerdict, type BossPhase } from '@/lib/meet/boss'

const CHEER_MS = 3200

const CHEERS = ['Done. Next.', 'That one went well. Mostly.', 'Moving on, like professionals.', 'Segment survived.', 'Good. Keep going.']
const NUDGES = [
  'That’s time. I’m only saying.',
  'A minute over. Still only saying.',
  'Two minutes over. Now I’m saying it louder.',
  'Three over. I can wrap this up for you.',
  'We are well into someone else’s segment.',
]

interface Mood {
  expression: Expression
  colour: KersColour
  motion: KersMotion
  special: KersEyes
  line: string | null
}

/**
 * Kers in the corner of the presenter screen. He cheers (a hop, happy eyes)
 * when a segment closes, gets restless with a minute left, and fidgets and
 * nudges once a segment overruns, louder each minute. In the Boss Round he
 * dares the room when it opens and gives his verdict by pass rate at time.
 * Nothing he says names anyone.
 */
export function PresenterKers({
  segmentKey,
  remaining,
  live,
  ended,
  boss,
  className,
}: {
  /** Changes when the presenter moves on: that's his cue to cheer. */
  segmentKey: string | null
  /** Seconds left in the segment (negative once over). */
  remaining: number
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
  else if (remaining < 0) {
    const over = Math.floor(-remaining / 60)
    mood = { expression: 'dramatic', colour: 'dramatic', motion: 'walk', special: null, line: NUDGES[Math.min(over, NUDGES.length - 1)] }
  } else if (remaining <= 60) mood = { expression: 'nosy', colour: 'meeting', motion: 'idle', special: null, line: 'One minute left.' }
  else mood = { expression: 'smug', colour: 'smug', motion: 'idle', special: null, line: null }

  return (
    <div className={cn('flex flex-col items-end gap-3', className)} aria-live="polite">
      <p
        className={cn(
          'max-w-[18rem] rounded-[18px] rounded-br-[6px] border border-border bg-paper px-4 py-2.5 text-[17px] leading-snug text-ink shadow-sm transition-opacity duration-300',
          mood.line ? 'opacity-100' : 'opacity-0',
        )}
      >
        {mood.line ?? ' '}
      </p>
      <Kers size={132} expression={mood.expression} colour={mood.colour} motion={mood.motion} special={mood.special} />
    </div>
  )
}

function verdictMood(pct: number, trying: number): Mood {
  const line = bossVerdict(pct, trying)
  if (trying === 0) return { expression: 'bored', colour: 'bored', motion: 'still', special: null, line }
  if (pct >= 75) return { expression: 'proud', colour: 'proud', motion: 'hop', special: 'happy', line }
  if (pct >= 25) return { expression: 'smug', colour: 'smug', motion: 'idle', special: null, line }
  return { expression: 'dramatic', colour: 'dramatic', motion: 'idle', special: null, line }
}
