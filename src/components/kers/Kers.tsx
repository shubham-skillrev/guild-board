'use client'

import { useEffect, useId, useState } from 'react'
import type { Expression } from '@guildboard/guildbot'
import { cn } from '@/lib/utils/cn'
import { Eye, PLUSH_COLOURS, eyeShape, useLookAt, type PlushColour } from '@/components/guildbot/PlushBot'
import { KERS_POSES, type KersPose, type PoseSpec } from '@/components/kers/poses'

/**
 * Kers, GuildBot's character: a puffy plush mouse cursor (↖). His body is a
 * rendered picture per pose (docs/kers/prompts.md); everything that changes
 * is drawn here on top of it:
 *
 * - Mood: his outline piping is sumi on an ordinary day and takes the mood's
 *   Japanese dye when his mood shifts (genie ruri, meeting budo too). The
 *   render's piping is a grey shading layer, dyed by a masked colour under it.
 * - Face: googly eyes (pupils follow the pointer) and stitched eyebrows.
 * - Cursor states, his quirk: a loader ring while he thinks, a blinking
 *   I-beam caret while he writes, a click ripple when he's pleased, a ⊘
 *   when he says no.
 *
 * Until a pose's render is processed (KERS_POSES[pose].ready), a rough
 * placeholder stands in, so the sheet can be built around him.
 */
export type KersState = 'thinking' | 'writing' | 'pleased' | 'refusing' | null
export type KersMotion = 'idle' | 'walk' | 'hop' | 'still'

const SUMI = '#2B2B2B'
const CREAM = '#F4EDE1'

/** His piping: sumi on a smug (ordinary) day, otherwise the mood's dye. */
export function pipingDye(colour: PlushColour): string {
  return colour === 'smug' ? SUMI : PLUSH_COLOURS[colour]
}

export function Kers({
  pose = 'standing',
  colour = 'smug',
  expression = 'smug',
  state = null,
  size = 120,
  motion = 'idle',
  follow = false,
  className,
}: {
  pose?: KersPose
  colour?: PlushColour
  expression?: Expression
  state?: KersState
  /** Height in px. */
  size?: number
  motion?: KersMotion
  follow?: boolean
  className?: string
}) {
  const look = useLookAt(follow)
  const shown = useWalkCycle(pose, motion)
  const spec = KERS_POSES[shown]
  const dye = pipingDye(colour)
  const face = shown === 'asleep' ? 'sleepy' : expression

  return (
    <span
      className={cn('gb-kers relative inline-block shrink-0', className)}
      style={{ width: (size * spec.w) / spec.h, height: size }}
      data-motion={motion}
    >
      <span className="gb-kers-body absolute inset-0">
        {spec.ready ? (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element -- layered sprites, sized by the wrapper */}
            <img src={`/kers/${shown}/body.webp`} alt="" draggable={false} className="absolute inset-0 w-full h-full" />
            <span
              aria-hidden
              className="absolute inset-0"
              style={{
                background: dye,
                maskImage: `url(/kers/${shown}/piping.webp)`,
                WebkitMaskImage: `url(/kers/${shown}/piping.webp)`,
                maskSize: '100% 100%',
                WebkitMaskSize: '100% 100%',
              }}
            />
            {/* eslint-disable-next-line @next/next/no-img-element -- the piping's shading, multiplied over the dye */}
            <img src={`/kers/${shown}/piping.webp`} alt="" draggable={false} className="absolute inset-0 w-full h-full mix-blend-multiply" />
            <svg viewBox={`0 0 ${spec.w} ${spec.h}`} className="absolute inset-0 w-full h-full overflow-visible" aria-hidden>
              <Face spec={spec} expression={face} look={look} />
              <States spec={spec} state={state} />
            </svg>
          </>
        ) : (
          <svg viewBox={`0 0 ${spec.w} ${spec.h}`} className="absolute inset-0 w-full h-full overflow-visible" aria-hidden>
            <KersPlaceholder spec={spec} dye={dye}>
              <Face spec={spec} expression={face} look={look} />
            </KersPlaceholder>
            <States spec={spec} state={state} />
          </svg>
        )}
      </span>
    </span>
  )
}

/** Walking swaps between the two step renders. */
function useWalkCycle(pose: KersPose, motion: KersMotion): KersPose {
  const [step, setStep] = useState(0)
  const walking = motion === 'walk'
  useEffect(() => {
    if (!walking || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => setStep(s => 1 - s), 260)
    return () => clearInterval(id)
  }, [walking])
  if (!walking) return pose
  return step ? 'walk-b' : 'walk-a'
}

/** Stitched eyebrows: how high each sits and how it tilts (inner end up for sad, down for cross). */
const BROWS: Partial<Record<Expression, { lift: [number, number]; tilt: [number, number] }>> = {
  smug: { lift: [0, 4], tilt: [0, -12] },
  bored: { lift: [-3, -3], tilt: [0, 0] },
  dramatic: { lift: [7, 7], tilt: [-8, 8] },
  proud: { lift: [3, 3], tilt: [-6, 6] },
  relieved: { lift: [2, 2], tilt: [6, -6] },
  excited: { lift: [6, 6], tilt: [-6, 6] },
  nosy: { lift: [0, 6], tilt: [0, -14] },
  lonely: { lift: [2, 2], tilt: [-14, 14] },
  sleepy: { lift: [-4, -4], tilt: [0, 0] },
  grumpy: { lift: [-2, -2], tilt: [16, -16] },
}

/** His googly eyes and stitched brows, placed for the pose. */
function Face({ spec, expression, look }: { spec: PoseSpec; expression: Expression; look: { x: number; y: number } }) {
  const shape = eyeShape(expression)
  const k = spec.eyeR / 12
  const brow = BROWS[expression] ?? { lift: [0, 0], tilt: [0, 0] }
  return (
    <g>
      {spec.eyes.map(([x, y], side) => (
        <g key={side} transform={`translate(${x} ${y}) scale(${k})`}>
          <Eye cx={0} cy={0} shape={shape} side={side as 0 | 1} look={look} lid={CREAM} />
          <path
            d="M-9 0H9"
            transform={`translate(0 ${-shape.r - 7 - brow.lift[side]}) rotate(${brow.tilt[side]})`}
            stroke={SUMI}
            strokeWidth={2.6}
            strokeDasharray="3.2 2.2"
            strokeLinecap="round"
          />
        </g>
      ))}
    </g>
  )
}

/** His cursor states, around the render. */
function States({ spec, state }: { spec: PoseSpec; state: KersState }) {
  if (!state) return null
  const [tx, ty] = spec.tip
  if (state === 'thinking') {
    const r = Math.max(spec.w, spec.h) * 0.5
    const c = 2 * Math.PI * r
    return (
      <circle className="gb-kers-spin" cx={spec.centre[0]} cy={spec.centre[1]} r={r} fill="none" stroke={SUMI} strokeOpacity={0.3} strokeWidth={10} strokeLinecap="round" strokeDasharray={`${c * 0.22} ${c * 0.78}`} />
    )
  }
  if (state === 'writing') {
    const [hx, hy] = spec.hand
    return <path className="gb-kers-caret" d={`M${hx + 46} ${hy - 90}v72M${hx + 34} ${hy - 90}h24M${hx + 34} ${hy - 18}h24`} stroke={SUMI} strokeWidth={7} strokeLinecap="round" fill="none" />
  }
  if (state === 'pleased') {
    return (
      <g className="gb-kers-ripple" fill="none" stroke={SUMI} strokeWidth={6}>
        <circle cx={tx} cy={ty} r={30} />
        <circle cx={tx} cy={ty} r={30} />
      </g>
    )
  }
  return (
    <g transform={`translate(${tx - 6} ${ty - 6})`}>
      <circle r={36} fill="#FFFFFF" stroke="#B7282E" strokeWidth={9} />
      <path d="M-24 24L24 -24" stroke="#B7282E" strokeWidth={9} strokeLinecap="round" />
    </g>
  )
}

/**
 * A rough stand-in for a pose that hasn't been rendered yet: the right
 * shape and layout (arrowhead body, two legs, the stem as his tail, stub
 * arms, piping), none of the plush. Not for the live app.
 */
function KersPlaceholder({ spec, dye, children }: { spec: PoseSpec; dye: string; children: React.ReactNode }) {
  const id = useId().replace(/:/g, '')
  const body = '176,78 452,400 322,440 176,478'
  const [la, ra] = spec.arms
  const lift = (side: 'left' | 'right') => (spec.step === side ? -26 : 0)
  const tube = (d: string, w: number) => (
    <>
      <path d={d} stroke={dye} strokeWidth={w + 16} strokeLinecap="round" fill="none" />
      <path d={d} stroke={`url(#${id}-cream)`} strokeWidth={w} strokeLinecap="round" fill="none" />
    </>
  )
  return (
    <g transform={spec.lying ? 'rotate(-90 300 320) scale(0.9)' : undefined} style={spec.lying ? { transformOrigin: '300px 320px' } : undefined}>
      <defs>
        <radialGradient id={`${id}-cream`} gradientUnits="userSpaceOnUse" cx={250} cy={220} r={420}>
          <stop offset="0%" stopColor="#FFFCF6" />
          <stop offset="60%" stopColor={CREAM} />
          <stop offset="100%" stopColor="#DCD1BE" />
        </radialGradient>
      </defs>
      <ellipse cx={270} cy={612} rx={170} ry={16} fill="#000" opacity={0.12} />
      {/* The stem is his tail, out of his lower back. */}
      {tube('M370 424Q450 470 500 450', 56)}
      {/* Two stubby legs and round feet. */}
      {tube(`M228 470L224 ${572 + lift('left')}`, 54)}
      {tube(`M304 452L306 ${572 + lift('right')}`, 54)}
      <ellipse cx={218} cy={588 + lift('left')} rx={42} ry={22} fill={`url(#${id}-cream)`} stroke={dye} strokeWidth={8} />
      <ellipse cx={312} cy={588 + lift('right')} rx={42} ry={22} fill={`url(#${id}-cream)`} stroke={dye} strokeWidth={8} />
      {/* The arrowhead: puffy, piped. */}
      <polygon points={body} fill={dye} stroke={dye} strokeWidth={104} strokeLinejoin="round" />
      <polygon points={body} fill={`url(#${id}-cream)`} stroke={`url(#${id}-cream)`} strokeWidth={84} strokeLinejoin="round" />
      {/* Stub arms, sewn on at his sides. */}
      {tube(`M196 360l${la[0]} ${la[1]}`, 40)}
      {tube(`M392 356l${ra[0]} ${ra[1]}`, 40)}
      {children}
    </g>
  )
}
