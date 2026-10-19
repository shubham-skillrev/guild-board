'use client'

import { useContext, useEffect, useRef, useState } from 'react'
import type { Expression, Wear } from '@guildboard/guildbot'
import { cn } from '@/lib/utils/cn'
import { useLookAt, type KersColour } from '@/components/kers/look'
import { WearContext } from '@/components/guildbot/useWeather'
import { RIGS, type KersPose, type Rig } from '@/components/kers/poses'
import { BOX, BlobFigure, MINT, faceAt, type MiniBlush, type MiniFace } from '@/components/kers/MiniKers'
import type { CursorPlay } from '@/components/kers/useCursorPlay'

/**
 * Kers, GuildBot's character: a round mint blob with big eyes cut out of
 * him (BlobFigure), and nothing else. Every expression lives in his eyes;
 * mood shows only as a blush, for strong moods; he has no limbs, so he acts
 * with his whole body: tilting, hopping, swaying, slumping.
 *
 * Around him: weather and activity gear, small cartoon marks by his head,
 * and his cursor states (a loader ring while he thinks, a blinking I-beam
 * caret while he writes, a click ripple when he's pleased, a not-allowed
 * sign when he says no). Poses (poses.ts) set how he sits and tilts and
 * what's beside him; motion is CSS (.gb-kers in globals.css) and stops under
 * reduced motion. Under 24px he's a simple mark.
 */
export type KersState = 'thinking' | 'writing' | 'pleased' | 'refusing' | null
export type KersMotion = 'idle' | 'walk' | 'hop' | 'dance' | 'still'
/** What he wears for what he's doing (the weather comes from WearContext). */
export type KersWear = 'headphones' | null
/** Eyes for a moment: pleased, shocked, patted. */
export type KersEyes = 'happy' | 'swirl' | 'heart' | null

/** His board expressions, as faces. */
const FACE_OF: Record<Expression, MiniFace> = {
  smug: 'curious',
  bored: 'bored',
  dramatic: 'shocked',
  proud: 'proud',
  relieved: 'happy',
  excited: 'happy',
  nosy: 'smug',
  lonely: 'sad',
  sleepy: 'sleepy',
  grumpy: 'sulky',
}

/** Blush only for strong moods. */
const BLUSH_OF: Partial<Record<KersColour, MiniBlush>> = {
  proud: 'proud',
  dramatic: 'dramatic',
  genie: 'genie',
  meeting: 'meeting',
}

export function Kers({
  pose = 'standing',
  colour = 'smug',
  expression = 'smug',
  state = null,
  size = 120,
  motion = 'idle',
  follow = false,
  tint,
  wear = null,
  play = null,
  special = null,
  className,
}: {
  pose?: KersPose
  /** His mood: shows as a blush, for strong moods. */
  colour?: KersColour
  expression?: Expression
  state?: KersState
  /** Height in px. */
  size?: number
  motion?: KersMotion
  follow?: boolean
  /** Any body colour, for the anonymous blobs in the focus crowd. */
  tint?: string
  wear?: KersWear
  /** Reacting to your cursor (useCursorPlay): pointing, leaning in, flinching. */
  play?: CursorPlay
  /** Eyes for a moment (the pleased ones come on their own). */
  special?: KersEyes
  className?: string
}) {
  const look = useLookAt(follow)
  const weather = useContext(WearContext)
  const walking = motion === 'walk' || pose === 'walk-a' || pose === 'walk-b'
  const rig = RIGS[motion === 'dance' ? 'arms-up' : pose]
  const asleep = !!(rig.lying || rig.sleep)
  const moment = special ?? (state === 'pleased' ? 'happy' : null)
  const face: MiniFace = asleep ? 'sleepy' : moment === 'happy' || moment === 'heart' ? 'happy' : moment === 'swirl' ? 'shocked' : FACE_OF[expression]
  const blush = BLUSH_OF[colour] ?? (moment === 'heart' ? 'proud' : null)
  const take = useDoubleTake(expression)
  const jiggle = useJiggle(walking ? 'walk' : motion)
  // Pointing at something you hover: he leans toward it, since he has no arms to point with.
  const tilt = (rig.tilt ?? 0) + (play === 'point' && !asleep ? -10 : 0)

  return (
    <span
      className={cn('gb-kers relative inline-block shrink-0', className)}
      style={{ width: size, height: size }}
      data-motion={walking ? 'walk' : motion}
      data-jiggle={jiggle ? '' : undefined}
      data-play={play ?? undefined}
      data-take={take ? '' : undefined}
      data-face={face}
    >
      <span className="gb-kers-body absolute inset-0">
        <svg viewBox={BOX} className="absolute inset-0 w-full h-full overflow-visible" aria-hidden>
          {size < 24 ? (
            <Mark tint={tint} />
          ) : (
            <>
              {rig.prop === 'cushion' && <Cushion />}
              <g transform={`translate(0 ${rig.dy * 0.6}) rotate(${tilt} 0 100)`}>
                <BlobFigure face={face} blush={blush} tint={tint} look={look} shadow={!rig.prop} />
                {!asleep && <Marks face={face} expression={expression} heart={moment === 'heart'} />}
                <Gear weather={weather} wear={wear} asleep={asleep} />
                {rig.prop === 'toothbrush' && <Toothbrush />}
              </g>
              {rig.prop === 'blanket' && <Blanket />}
              <States rig={rig} state={state} />
            </>
          )}
        </svg>
      </span>
    </span>
  )
}

/** A double-take when his face changes (something just happened). */
function useDoubleTake(expression: Expression): boolean {
  const [on, setOn] = useState(false)
  const last = useRef(expression)
  useEffect(() => {
    if (last.current === expression) return
    last.current = expression
    const start = setTimeout(() => setOn(true), 0)
    const stop = setTimeout(() => setOn(false), 460)
    return () => { clearTimeout(start); clearTimeout(stop) }
  }, [expression])
  return on
}

/** A little settle when he stops walking or dancing, like a squishy toy coming to rest. */
function useJiggle(motion: KersMotion): boolean {
  const [on, setOn] = useState(false)
  const last = useRef(motion)
  useEffect(() => {
    const was = last.current
    last.current = motion
    if (motion !== 'idle' || (was !== 'walk' && was !== 'dance')) return
    const start = setTimeout(() => setOn(true), 0)
    const stop = setTimeout(() => setOn(false), 650)
    return () => { clearTimeout(start); clearTimeout(stop) }
  }, [motion])
  return on
}

/** Under 24px: a little rounded mint square with two dot eyes. */
function Mark({ tint }: { tint?: string }) {
  return (
    <g>
      <rect x={-100} y={-96} width={200} height={196} rx={80} fill={tint ?? MINT} />
      <ellipse cx={-30} cy={24} rx={18} ry={22} fill="#0E1412" />
      <ellipse cx={30} cy={24} rx={18} ry={22} fill="#0E1412" />
    </g>
  )
}

/** Cartoon marks by his head: an anger vein when sulky, sparkles when proud, a ? when nosy, a sweat drop when sad, hearts when patted. */
function Marks({ face, expression, heart }: { face: MiniFace; expression: Expression; heart: boolean }) {
  if (heart) {
    return (
      <g className="kx-mark" fill="#FF6B8A">
        <path d="M70 -86C62 -98 46 -88 54 -76L70 -60L86 -76C94 -88 78 -98 70 -86Z" />
        <path d="M100 -56C95 -63 86 -57 90 -50L100 -40L110 -50C114 -57 105 -63 100 -56Z" opacity={0.8} />
      </g>
    )
  }
  if (face === 'sulky') {
    return (
      <g transform="translate(78 -78)" stroke="#E04848" strokeWidth={7} strokeLinecap="round" fill="none" className="kx-mark">
        <path d="M-14 -4q6 0 8-8M4 -14q0 6 8 8M14 4q-6 0-8 8M-4 14q0-6-8-8" />
      </g>
    )
  }
  if (face === 'proud') {
    return (
      <g fill="#F6C431" className="kx-mark">
        <path d="M72 -96l5 12 12 5-12 5-5 12-5-12-12-5 12-5Z" />
        <path d="M104 -60l3 8 8 3-8 3-3 8-3-8-8-3 8-3Z" />
      </g>
    )
  }
  if (expression === 'nosy') return <text x={70} y={-60} fontSize={52} fontWeight={800} className="kx-mark kx-ink-fill">?</text>
  if (face === 'sad') return <path className="kx-mark" d="M86 -84c9 13 13 20 13 25a13 13 0 0 1-26 0c0-5 4-12 13-25Z" fill="#8EC2FF" />
  return null
}

/** Weather and activity gear, sized to his round body. */
function Gear({ weather, wear, asleep }: { weather: Wear; wear: KersWear; asleep: boolean }) {
  const [fx, fy] = faceAt()
  const ey = fy + 22
  return (
    <g>
      {weather.umbrella && !asleep && (
        <g className="gb-kers-float">
          <path d="M10 -150v58" stroke="#3A3F4F" strokeWidth={6} strokeLinecap="round" />
          <path d="M-90 -140Q10 -230 110 -140q-25-15-50 0-25-15-50 0-25-15-50 0-25-15-50 0Z" fill="#3E7BFA" />
        </g>
      )}
      {weather.beanie && (
        <g>
          <path d="M-74 -62C-70 -128 70 -128 74 -62Z" fill="#2F3A56" />
          <rect x={-82} y={-70} width={164} height={22} rx={11} fill="#46557A" />
          <circle cx={0} cy={-122} r={14} fill="#E9E4DA" />
        </g>
      )}
      {wear === 'headphones' && (
        <g>
          <path d="M-96 0C-96 -132 96 -132 96 0" fill="none" stroke="#2A2F3D" strokeWidth={11} strokeLinecap="round" />
          <rect x={-114} y={-20} width={28} height={50} rx={14} fill="#2A2F3D" />
          <rect x={86} y={-20} width={28} height={50} rx={14} fill="#2A2F3D" />
        </g>
      )}
      {weather.sunglasses && !weather.beanie && !asleep && (
        <g transform={`translate(${fx} ${ey})`}>
          <ellipse cx={-31} cy={0} rx={30} ry={24} fill="#121318" />
          <ellipse cx={31} cy={0} rx={30} ry={24} fill="#121318" />
          <path d="M-2 -4h4" stroke="#121318" strokeWidth={6} strokeLinecap="round" />
          <path d="M-44 -12l12 -6M18 -12l12 -6" stroke="#FFFFFF" strokeOpacity={0.5} strokeWidth={4} strokeLinecap="round" />
        </g>
      )}
      {weather.scarf && (
        <g>
          <path d="M-92 66q92 30 184 0l-4 18q-88 30-176 0Z" fill="#E2624F" />
          <path d="M40 78l6 36h16l-6-38Z" fill="#E2624F" />
        </g>
      )}
      {weather.sweat && !asleep && (
        <g className="gb-kers-sweat" fill="#8EC2FF">
          <path data-drop d="M84 -58c7 10 10 15 10 19a10 10 0 0 1-20 0c0-4 3-9 10-19Z" />
          <path data-drop d="M-88 -40c6 8 8 12 8 15a8 8 0 0 1-16 0c0-3 2-7 8-15Z" />
        </g>
      )}
    </g>
  )
}

/** Asleep away from his desk: a striped blanket pulled up over him. */
function Blanket() {
  return (
    <g>
      <path d="M-118 40Q0 10 118 40L122 112Q0 128 -122 112Z" fill="#6E86B8" />
      <path d="M-118 62Q0 34 120 60M-120 86Q0 62 121 84" stroke="#9AB0DA" strokeWidth={10} fill="none" strokeLinecap="round" />
    </g>
  )
}

/** Meditating: a round cushion under him. */
function Cushion() {
  return (
    <g>
      <ellipse cx={0} cy={108} rx={118} ry={22} fill="#A9513A" />
      <ellipse cx={0} cy={100} rx={110} ry={16} fill="#C76A4E" />
    </g>
  )
}

/** Brushing: a toothbrush scrubbing just under his eyes, with a little foam. */
function Toothbrush() {
  return (
    <g className="gb-kers-brush">
      <path d="M118 96L24 60" stroke="#3E7BFA" strokeWidth={11} strokeLinecap="round" />
      <rect x={4} y={48} width={26} height={16} rx={4} fill="#F3F1EC" />
      <circle cx={0} cy={56} r={8} fill="#FFFFFF" />
      <circle cx={-10} cy={68} r={6} fill="#FFFFFF" />
    </g>
  )
}

/** His cursor states, around him. */
function States({ rig, state }: { rig: Rig; state: KersState }) {
  if (!state) return null
  const dy = rig.dy * 0.6
  if (state === 'thinking') {
    const r = 118
    const c = 2 * Math.PI * r
    return <circle className="gb-kers-spin kx-ink" cx={0} cy={dy} r={r} fill="none" strokeOpacity={0.35} strokeWidth={8} strokeLinecap="round" strokeDasharray={`${c * 0.22} ${c * 0.78}`} />
  }
  if (state === 'writing') {
    return <path className="gb-kers-caret kx-ink" d={`M122 ${-30 + dy}v60M112 ${-30 + dy}h20M112 ${30 + dy}h20`} strokeWidth={7} strokeLinecap="round" fill="none" />
  }
  if (state === 'pleased') {
    return (
      <g className="gb-kers-ripple kx-ink" fill="none" strokeWidth={5}>
        <circle cx={-80} cy={-80 + dy} r={18} />
        <circle cx={-80} cy={-80 + dy} r={18} />
      </g>
    )
  }
  return (
    <g transform={`translate(-82 ${-82 + dy})`}>
      <circle r={26} fill="#FFFFFF" stroke="#B7282E" strokeWidth={7} />
      <path d="M-17 17L17 -17" stroke="#B7282E" strokeWidth={7} strokeLinecap="round" />
    </g>
  )
}
