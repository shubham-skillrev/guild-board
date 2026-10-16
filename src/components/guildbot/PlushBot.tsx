'use client'

import { useContext, useEffect, useId, useRef, useState } from 'react'
import type { Expression, Mood } from '@guildboard/guildbot'
import { cn } from '@/lib/utils/cn'
import { WearContext } from '@/components/guildbot/useWeather'

/**
 * GuildBot as a plush toy: one soft stuffed shape (see SHAPES), sewn and
 * furry like the real thing, with googly eyes and nothing else on his face.
 *
 * - Colour is his mood for the month (smug saffron, bored lilac, dramatic
 *   tomato, proud gold), with two moments of their own: genie blue for the
 *   last three asks, plum while he sulks about the meeting. It changes
 *   slowly; quick reactions show in his eyes and squash, never his colour.
 * - Floating hands and feet on faint lines (Rayman rules): they swing when
 *   he walks and dances, and do the jobs (typing, a mug, a wave, a brush).
 * - Dressed by the weather in your city and by what he's doing (headphones,
 *   a sleep mask); there is no outfit he always wears.
 * - The toy is drawn in SVG: soft shading that sags at the bottom, a furry
 *   edge, the nap of the fur, a stitched seam, a fabric tag. Fur and tag are
 *   skipped when he's small, where they'd only cost frames.
 *
 * Motion lives in globals.css (.gb-plush) and stops under reduced motion.
 */
export type PlushColour = Mood | 'genie' | 'meeting'
export type PlushMotion = 'idle' | 'hop' | 'dance' | 'stretch' | 'walk' | 'still'
/** His arms: both at his sides (rest), only the left (a scene gives him the right), none, or a job. */
export type PlushHands = 'rest' | 'one' | 'none' | 'typing' | 'mug' | 'wave' | 'brush'
export type PlushWear = 'headphones' | 'sleepmask'

export const PLUSH_COLOURS: Record<PlushColour, string> = {
  smug: '#FF9A3C',
  bored: '#B6A2E6',
  dramatic: '#EE5440',
  proud: '#F6C431',
  genie: '#3E7BFA',
  meeting: '#7D3F7D',
}

/**
 * His silhouette. Three concepts for sign-off on the character sheet; the
 * app draws PLUSH_SHAPE. Each is one soft shape plus one quirk (the dots
 * way), sewn like a real toy: a stitched seam, fur, a fabric tag.
 *
 *   cushion  the board's ◈ as a puffed-up pillow: bulging sides, pinched
 *            corners with little tassels
 *   critter  a round bean of a creature with two felt ◈ ears
 *   mochi    a squishy round mochi with a stitched ◈ patch on his tummy
 */
export type PlushShape = 'cushion' | 'critter' | 'mochi'

interface ShapeSpec {
  body: string
  /** The middle of the body, for the inset seam. */
  centre: [number, number]
  /** Top of the head (hats), the eye line, and where a scarf sits. */
  top: number
  eyes: number
  neck: number
  shoulders: [[number, number], [number, number]]
  hips: [[number, number], [number, number]]
  /** Where the fabric tag pokes out of the seam, and its angle. */
  tag: [number, number, number]
}

const SHAPES: Record<PlushShape, ShapeSpec> = {
  cushion: {
    body: 'M45 13Q50 8 55 13C70 16 86 29 91 45Q96 52 91 59C86 75 70 88 55 92Q50 97 45 92C30 88 14 75 9 59Q4 52 9 45C14 29 30 16 45 13Z',
    centre: [50, 52], top: 12, eyes: 48, neck: 64,
    shoulders: [[14, 50], [86, 50]], hips: [[44, 88], [56, 88]], tag: [80, 76, -38],
  },
  critter: {
    body: 'M50 26C77 26 91 37 91 60C91 84 75 95 50 95C25 95 9 84 9 60C9 37 23 26 50 26Z',
    centre: [50, 61], top: 26, eyes: 56, neck: 72,
    shoulders: [[13, 64], [87, 64]], hips: [[42, 92], [58, 92]], tag: [88, 76, -20],
  },
  mochi: {
    body: 'M50 16C80 16 93 30 93 56C93 83 77 95 50 95C23 95 7 83 7 56C7 30 20 16 50 16Z',
    centre: [50, 56], top: 16, eyes: 48, neck: 66,
    shoulders: [[12, 56], [88, 56]], hips: [[42, 92], [58, 92]], tag: [90, 70, -15],
  },
}

/** The shape the app uses. */
export const PLUSH_SHAPE: PlushShape = 'critter'

export type PlushStatus = 'thinking' | 'talking' | null
/** What he's up to while you chat or work: some of it shows on him. */
export type AvatarStatus = 'idle' | 'listening' | 'searching' | 'thinking' | 'writing' | 'talking'

type FigureProps = {
  colour?: PlushColour
  expression?: Expression
  hands?: PlushHands
  /** What he's wearing for what he's doing (weather comes from WearContext). */
  wear?: PlushWear | null
  /** Thought dots, or sound lines while he talks. */
  status?: PlushStatus
  /** Felt fuzz and grain: off for small drawings. */
  fuzzy?: boolean
  /** Floating hands and feet on faint lines. Off for marks too small to read them. */
  limbs?: boolean
  /** Any felt colour, for the anonymous plushes in the focus crowd. */
  tint?: string
  /** For the character sheet's comparison; the app uses PLUSH_SHAPE. */
  shape?: PlushShape
  look?: { x: number; y: number }
}

/** The plush on his own, sized in px. */
export function PlushBot({
  size = 80,
  motion = 'idle',
  follow = false,
  className,
  ...figure
}: Omit<FigureProps, 'fuzzy' | 'look'> & {
  /** Height in px. */
  size?: number
  motion?: PlushMotion
  /** Pupils follow the pointer (fine pointers only, never under reduced motion). */
  follow?: boolean
  className?: string
}) {
  const look = useLookAt(follow)
  return (
    <span className={cn('gb-plush relative inline-block shrink-0', className)} style={{ width: size * 1.2, height: size }} data-motion={motion}>
      <svg viewBox="-10 -14 120 120" width="100%" height="100%" aria-hidden className="overflow-visible">
        <PlushFigure {...figure} fuzzy={size >= 56} look={look} />
      </svg>
    </span>
  )
}

/**
 * The plush as SVG, for scenes to place: drawn in a -10 -14 120 120 box,
 * body from about (5, 11) to (95, 94), feet on y 104. Wrap it in a <g>
 * with `.gb-plush` and `data-motion` on an ancestor to animate it.
 */
export function PlushFigure({
  colour = 'smug',
  expression = 'smug',
  hands = 'rest',
  wear,
  status = null,
  fuzzy = true,
  limbs: withLimbs = true,
  tint,
  shape = PLUSH_SHAPE,
  look = { x: 0, y: 0 },
}: FigureProps) {
  const id = useId().replace(/:/g, '')
  const base = tint ?? PLUSH_COLOURS[colour]
  const weather = useContext(WearContext)
  const eyes = eyeShape(expression)
  const spec = SHAPES[shape]
  const limbs = withLimbs ? limbsFor(hands, spec) : []
  // Costumes were drawn for a head at y 11 and eyes at y 42; move them to this shape.
  const atTop = `translate(0 ${spec.top - 11})`
  const atEyes = `translate(0 ${spec.eyes - 42})`
  const atNeck = `translate(0 ${spec.neck - 55})`
  const seam = `translate(${spec.centre[0]} ${spec.centre[1]}) scale(0.86) translate(${-spec.centre[0]} ${-spec.centre[1]})`
  const edge = mix(base, '#000000', 0.3)

  return (
    <g>
        <defs>
          <radialGradient id={`${id}-felt`} cx="40%" cy="30%" r="78%">
            <stop offset="0%" stopColor={mix(base, '#FFFFFF', 0.4)} />
            <stop offset="48%" stopColor={base} />
            <stop offset="100%" stopColor={mix(base, '#000000', 0.12)} />
          </radialGradient>
          {/* Soft shadow pooling at the bottom, where a stuffed toy sags. */}
          <linearGradient id={`${id}-sag`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="55%" stopColor="#000000" stopOpacity={0} />
            <stop offset="100%" stopColor="#000000" stopOpacity={0.16} />
          </linearGradient>
          <radialGradient id={`${id}-sheen`}>
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
          </radialGradient>
          {fuzzy && (
            <filter id={`${id}-fuzz`} x="-15%" y="-15%" width="130%" height="130%">
              {/* A soft, furry edge... */}
              <feTurbulence type="fractalNoise" baseFrequency="0.75" numOctaves="2" seed="7" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="3" xChannelSelector="R" yChannelSelector="G" result="furry" />
              {/* ...and the nap of the fur: stretched noise, dark and light flecks. */}
              <feTurbulence type="fractalNoise" baseFrequency="2.6 0.8" numOctaves="2" seed="3" result="nap" />
              <feColorMatrix in="nap" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0.55 0 0 0 -0.16" result="napDark" />
              <feColorMatrix in="nap" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0.5 0 0 -0.17" result="napLight" />
              <feComposite in="napDark" in2="furry" operator="in" result="darkOnBody" />
              <feComposite in="napLight" in2="furry" operator="in" result="lightOnBody" />
              <feMerge><feMergeNode in="furry" /><feMergeNode in="darkOnBody" /><feMergeNode in="lightOnBody" /></feMerge>
            </filter>
          )}
        </defs>

        {/* Shadow on whatever he sits on. */}
        <ellipse className="gb-plush-shadow" cx={50} cy={104} rx={26} ry={3.6} fill="#000" opacity={0.18} />

        {weather.umbrella && (
          <g className="gb-plush-float-prop">
            <path d="M50 -10v26" stroke="#3A3F4F" strokeWidth={2.2} strokeLinecap="round" />
            <path d="M14 -2Q50 -34 86 -2q-9-5-18 0-9-5-18 0-9-5-18 0-9-5-18 0Z" fill="#3E7BFA" stroke="#1E2B57" strokeWidth={1.6} strokeLinejoin="round" />
          </g>
        )}

        <g className="gb-plush-body">
          {/* Limb lines go behind him, so they seem to come out of the felt. */}
          <Limbs limbs={limbs} colour={base} layer="lines" />
          {shape === 'critter' && <Ears colour={base} fuzz={fuzzy ? `url(#${id}-fuzz)` : undefined} />}
          {shape === 'cushion' && <Tassels colour={base} />}
          <path d={spec.body} fill={`url(#${id}-felt)`} filter={fuzzy ? `url(#${id}-fuzz)` : undefined} />
          <path d={spec.body} fill={`url(#${id}-sag)`} />
          {/* The seam it was sewn along, and a soft patch of light. */}
          <path d={spec.body} transform={seam} fill="none" stroke={edge} strokeOpacity={0.4} strokeWidth={1.1} strokeDasharray="2.4 2" strokeLinecap="round" />
          <ellipse cx={40} cy={spec.top + 12} rx={14} ry={6} fill={`url(#${id}-sheen)`} transform={`rotate(-20 40 ${spec.top + 12})`} />
          {shape === 'mochi' && <Patch />}
          {fuzzy && <Tag at={spec.tag} />}

          {weather.beanie && (
            <g transform={atTop}>
              <path d="M28 20C32 0 68 0 72 20Z" fill="#2F3A56" />
              <path d="M25 18h50v7H25Z" fill="#46557A" />
              <circle cx={50} cy={-1} r={5} fill="#E9E4DA" />
            </g>
          )}
          {wear === 'headphones' && (
            <g transform={atEyes}>
              <path d="M17 36C17 2 83 2 83 36" fill="none" stroke="#2A2F3D" strokeWidth={4.5} strokeLinecap="round" />
              <rect x={6} y={30} width={12} height={20} rx={6} fill="#2A2F3D" />
              <rect x={82} y={30} width={12} height={20} rx={6} fill="#2A2F3D" />
            </g>
          )}

          {/* Googly eyes: white, a black pupil that wanders, a felt lid. */}
          <g className="gb-plush-eyes">
            {[34, 66].map((cx, side) => (
              <Eye key={cx} cx={cx} cy={spec.eyes} shape={eyes} side={side as 0 | 1} look={look} lid={base} />
            ))}
          </g>

          {wear === 'sleepmask' && (
            <g transform={atEyes}>
              <rect x={14} y={33} width={72} height={18} rx={9} fill="#3B4A7A" />
              <path d="M27 43q7 4 14 0M59 43q7 4 14 0" stroke="#E9E4DA" strokeWidth={2} fill="none" strokeLinecap="round" />
            </g>
          )}
          {weather.sunglasses && !weather.beanie && wear !== 'sleepmask' && (
            <g transform={atEyes}>
              <circle cx={34} cy={42} r={13.5} fill="#121318" />
              <circle cx={66} cy={42} r={13.5} fill="#121318" />
              <path d="M47 41h6M20.5 39l-12-4M79.5 39l12-4" stroke="#121318" strokeWidth={2.6} strokeLinecap="round" />
              <path d="M28 36l5-2.5M60 36l5-2.5" stroke="#FFFFFF" strokeOpacity={0.5} strokeWidth={1.8} strokeLinecap="round" />
            </g>
          )}
          {weather.scarf && (
            <g transform={atNeck}>
              <path d="M11 55q39 15 78 0l-4 8q-35 13-70 0Z" fill="#16774F" />
              <path d="M62 64l2 16h7l-2-17Z" fill="#16774F" />
            </g>
          )}
          <Limbs limbs={limbs} colour={base} layer="ends" />
        </g>

        {weather.sweat && (
          <g className="gb-plush-sweat" fill="#8EC2FF" transform={atTop}>
            <path data-drop d="M12 20c2 2.8 2.8 4.2 2.8 5.4a2.8 2.8 0 0 1-5.6 0c0-1.2.8-2.6 2.8-5.4Z" />
            <path data-drop d="M90 24c1.8 2.4 2.4 3.6 2.4 4.6a2.4 2.4 0 0 1-4.8 0c0-1 .6-2.2 2.4-4.6Z" />
          </g>
        )}


        {status === 'thinking' && (
          <g className="gb-plush-status" fill="#8A8F9C">
            <circle data-dot cx={88} cy={14} r={3} />
            <circle data-dot cx={96} cy={4} r={4} />
            <circle data-dot cx={105} cy={-8} r={5} />
          </g>
        )}
        {status === 'talking' && (
          <g className="gb-plush-status" fill="none" stroke="#8A8F9C" strokeWidth={2.4} strokeLinecap="round">
            <path data-wave d="M96 40q4 8 0 16" />
            <path data-wave d="M103 34q6 14 0 28" />
          </g>
        )}
    </g>
  )
}

/** Critter: two felt ◈ ears, behind the head, a lighter felt inside. */
function Ears({ colour, fuzz }: { colour: string; fuzz?: string }) {
  const inner = mix(colour, '#FFFFFF', 0.45)
  return (
    <g>
      {[[28, 26, -14], [72, 26, 14]].map(([x, y, r]) => (
        <g key={x} transform={`translate(${x} ${y}) rotate(${r})`}>
          <rect x={-10} y={-10} width={20} height={20} rx={6} transform="rotate(45)" fill={colour} filter={fuzz} />
          <rect x={-5} y={-5} width={10} height={10} rx={3} transform="translate(0 -2) rotate(45)" fill={inner} />
        </g>
      ))}
    </g>
  )
}

/** Cushion: little tassels where the pillow's side corners are pinched. */
function Tassels({ colour }: { colour: string }) {
  const thread = mix(colour, '#000000', 0.2)
  return (
    <g stroke={thread} strokeWidth={1.6} strokeLinecap="round" fill="none">
      <path d="M6 52l-6-3M6 52l-6 1M6 52l-5 5" />
      <path d="M94 52l6-3M94 52l6 1M94 52l5 5" />
    </g>
  )
}

/** Mochi: a stitched ◈ patch, sewn on low at one side (never under the eyes, where it would read as a mouth). */
function Patch() {
  return (
    <g transform="translate(30 80) rotate(-14) scale(0.85)">
      <rect x={-7.5} y={-7.5} width={15} height={15} rx={3} transform="rotate(45)" fill="#FFF4E2" />
      <rect x={-6} y={-6} width={12} height={12} rx={2.4} transform="rotate(45)" fill="none" stroke="#C9822F" strokeWidth={0.9} strokeDasharray="1.6 1.4" />
    </g>
  )
}

/** The fabric care tag every plush has, poking out of a seam. */
function Tag({ at: [x, y, r] }: { at: [number, number, number] }) {
  return (
    <g transform={`translate(${x} ${y}) rotate(${r})`}>
      <path d="M0 -3.5h9a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5H0Z" fill="#FBF6EC" stroke="#000000" strokeOpacity={0.15} strokeWidth={0.6} />
      <path d="M3 -1h5M3 1.2h3.5" stroke="#E8913A" strokeWidth={0.9} strokeLinecap="round" />
    </g>
  )
}

/** A felt hand (a soft little diamond, like him), for scenes that hand him things (chopsticks, a book). */
export function Mitten({ x, y, colour = 'smug', flip = false, rot = 0, scale = 0.55 }: { x: number; y: number; colour?: PlushColour; flip?: boolean; rot?: number; scale?: number }) {
  const base = PLUSH_COLOURS[colour]
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${flip ? -scale : scale} ${scale})`}>
      <rect x={-6.5} y={-6.5} width={13} height={13} rx={4.5} transform="rotate(45)" fill={mix(base, '#FFFFFF', 0.35)} stroke={mix(base, '#000000', 0.25)} strokeWidth={1.2} />
      <ellipse cx={-1.6} cy={-3.6} rx={2.4} ry={1.4} fill="#FFFFFF" opacity={0.45} />
    </g>
  )
}

type EyeShape = {
  /** Eye white radius. */
  r: number
  /** Lid coverage from the top, 0 open to 1 shut, per eye. */
  lid: [number, number]
  /** Lid tilt in degrees (inner end down for grumpy), per eye. */
  tilt: [number, number]
  /** Pupil offset and size. */
  pupil: { dx: number; dy: number; r: number }
  /** Happy closed arcs instead of eyes. */
  arcs?: 'up' | 'down'
  sparkle?: boolean
}

function eyeShape(e: Expression): EyeShape {
  const open: EyeShape = { r: 12, lid: [0, 0], tilt: [0, 0], pupil: { dx: 0, dy: 1, r: 5.4 } }
  switch (e) {
    case 'smug': return { ...open, lid: [0.1, 0.45], tilt: [0, -8], pupil: { dx: 2.8, dy: 1, r: 5.2 } }
    case 'bored': return { ...open, lid: [0.5, 0.5], pupil: { dx: 0, dy: 3.5, r: 5 } }
    case 'dramatic': return { ...open, r: 14.5, pupil: { dx: 0, dy: 0, r: 3.8 } }
    case 'proud': return { ...open, arcs: 'up' }
    case 'relieved': return { ...open, arcs: 'down' }
    case 'excited': return { ...open, r: 13, pupil: { dx: 0, dy: 0, r: 6.2 }, sparkle: true }
    case 'nosy': return { ...open, lid: [0.35, 0.1], pupil: { dx: -5.5, dy: 0, r: 5 } }
    case 'lonely': return { ...open, lid: [0.25, 0.25], tilt: [10, -10], pupil: { dx: 0, dy: 4, r: 5.2 } }
    case 'sleepy': return { ...open, lid: [0.85, 0.85], pupil: { dx: 0, dy: 3.5, r: 5 } }
    case 'grumpy': return { ...open, lid: [0.4, 0.4], tilt: [-18, 18], pupil: { dx: 0, dy: 1.5, r: 5.2 } }
    default: return open
  }
}

function Eye({ cx, cy, shape, side, look, lid }: { cx: number; cy: number; shape: EyeShape; side: 0 | 1; look: { x: number; y: number }; lid: string }) {
  const clip = useId().replace(/:/g, '')
  if (shape.arcs) {
    const d = shape.arcs === 'up' ? `M${cx - 9.5} ${cy + 3.5}q9.5 -12 19 0` : `M${cx - 9.5} ${cy - 2.5}q9.5 10 19 0`
    return <path d={d} stroke="#1A1A1F" strokeWidth={4.2} strokeLinecap="round" fill="none" />
  }
  const { r, pupil } = shape
  const cover = shape.lid[side]
  const tilt = shape.tilt[side]
  const px = Math.max(-r + pupil.r + 1, Math.min(r - pupil.r - 1, pupil.dx + look.x))
  const py = Math.max(-r + pupil.r + 1, Math.min(r - pupil.r - 1, pupil.dy + look.y))
  const lidY = cy - r + 2 * r * cover
  return (
    <g data-eye>
      <clipPath id={clip}><circle cx={cx} cy={cy} r={r} /></clipPath>
      <circle cx={cx} cy={cy} r={r} fill="#FFFFFF" stroke="#1A1A1F" strokeOpacity={0.15} strokeWidth={1} />
      <circle cx={cx + px} cy={cy + py} r={pupil.r} fill="#1A1A1F" style={{ transition: 'cx 160ms ease-out, cy 160ms ease-out' }} />
      <circle cx={cx + px + pupil.r * 0.35} cy={cy + py - pupil.r * 0.4} r={pupil.r * 0.32} fill="#FFFFFF" />
      {shape.sparkle && <path d={`M${cx + px - 1} ${cy + py - 1.5}l.8 1.5 1.5.8-1.5.8-.8 1.5-.8-1.5-1.5-.8 1.5-.8Z`} fill="#FFFFFF" />}
      {cover > 0 && (
        // A felt lid, in his colour, coming down from the top, with its edge.
        <g clipPath={`url(#${clip})`} transform={`rotate(${tilt} ${cx} ${lidY})`}>
          <rect x={cx - r - 4} y={cy - r - 6} width={2 * r + 8} height={lidY - (cy - r - 6)} fill={lid} />
          <path d={`M${cx - r - 4} ${lidY}h${2 * r + 8}`} stroke="#1A1A1F" strokeOpacity={0.55} strokeWidth={1.6} />
        </g>
      )}
    </g>
  )
}

type Limb = {
  /** Shoulder or hip, where the faint line starts (and the limb pivots). */
  at: [number, number]
  /** Where the hand or foot floats, from there. */
  to: [number, number]
  kind: 'hand' | 'foot'
  /** Animation class: the pivot rotates or shifts the whole limb. */
  cls: string
  /** Something held, drawn around the hand. */
  holding?: React.ReactNode
}

/** Where the arms come from, for scenes that draw his hands themselves. */
export const SHOULDER_L: [number, number] = SHAPES[PLUSH_SHAPE].shoulders[0]
export const SHOULDER_R: [number, number] = SHAPES[PLUSH_SHAPE].shoulders[1]

/**
 * Rayman rules: hands and feet float off the body, joined by the faintest
 * line, so walking and dancing read as walking and dancing.
 */
function limbsFor(hands: PlushHands, spec: ShapeSpec): Limb[] {
  const [SL, SR] = spec.shoulders
  const restL: Limb = { at: SL, to: [-16, 18], kind: 'hand', cls: 'gb-arm-l' }
  const restR: Limb = { at: SR, to: [16, 18], kind: 'hand', cls: 'gb-arm-r' }
  const feet: Limb[] = [
    { at: spec.hips[0], to: [-8, 104 - 4.5 - spec.hips[0][1]], kind: 'foot', cls: 'gb-leg-l' },
    { at: spec.hips[1], to: [8, 104 - 4.5 - spec.hips[1][1]], kind: 'foot', cls: 'gb-leg-r' },
  ]
  const arms: Limb[] = (() => {
    switch (hands) {
      case 'none': return []
      case 'one': return [restL]
      case 'rest': return [restL, restR]
      case 'typing':
        return [
          { at: SL, to: [20, 24], kind: 'hand', cls: 'gb-mitten-l' },
          { at: SR, to: [-20, 24], kind: 'hand', cls: 'gb-mitten-r' },
        ]
      case 'wave': return [restL, { at: SR, to: [14, -28], kind: 'hand', cls: 'gb-mitten-wave' }]
      case 'mug':
        return [restL, {
          at: SR, to: [10, 16], kind: 'hand', cls: 'gb-mitten-mug',
          holding: (
            <g transform="translate(-93 -74)">
              <path d="M90 58h14v13a4 4 0 0 1-4 4h-6a4 4 0 0 1-4-4Z" fill="#E8913A" stroke="#3A2E22" strokeWidth={1.4} />
              <path d="M104 62a3.5 3.5 0 0 1 0 7" stroke="#3A2E22" strokeWidth={1.8} fill="none" />
              <path d="M95 54c-1.6-2 1.6-3 0-5M99 54c-1.6-2 1.6-3 0-5" stroke="#8A8F9C" strokeWidth={1.2} fill="none" strokeLinecap="round" />
            </g>
          ),
        }]
      case 'brush':
        return [restL, {
          at: SR, to: [6, 12], kind: 'hand', cls: 'gb-mitten-brush',
          holding: (
            <g transform="translate(-90 -72)">
              <path d="M64 70h22" stroke="#3E7BFA" strokeWidth={3} strokeLinecap="round" />
              <path d="M63 66v8" stroke="#E9E4DA" strokeWidth={4} strokeLinecap="round" />
              <circle cx={58} cy={66} r={2} fill="#FFFFFF" />
              <circle cx={56} cy={71} r={1.5} fill="#FFFFFF" />
            </g>
          ),
        }]
    }
  })()
  return [...feet, ...arms]
}

/** The limbs, in two passes: the faint lines (behind the body), then the felt hands and feet. */
function Limbs({ limbs, colour, layer }: { limbs: Limb[]; colour: string; layer: 'lines' | 'ends' }) {
  if (!limbs.length) return null
  const felt = mix(colour, '#FFFFFF', 0.35)
  const edge = mix(colour, '#000000', 0.3)
  return (
    <g>
      {limbs.map(l => (
        <g key={l.cls} transform={`translate(${l.at[0]} ${l.at[1]})`}>
          <g className={l.cls}>
            {layer === 'lines' ? (
              <path d={`M0 0L${l.to[0]} ${l.to[1]}`} stroke={edge} strokeOpacity={0.45} strokeWidth={1.8} strokeLinecap="round" fill="none" />
            ) : (
              <g transform={`translate(${l.to[0]} ${l.to[1]})`}>
                {l.holding}
                {l.kind === 'hand' ? (
                  <>
                    <rect x={-6.5} y={-6.5} width={13} height={13} rx={4.5} transform="rotate(45)" fill={felt} stroke={edge} strokeWidth={1.3} />
                    <ellipse cx={-1.6} cy={-3.6} rx={2.4} ry={1.4} fill="#FFFFFF" opacity={0.45} />
                  </>
                ) : (
                  // A soft little shoe, toes out.
                  <rect x={-8} y={-4.5} width={16} height={9} rx={4.5} transform={`rotate(${l.to[0] < 0 ? -8 : 8})`} fill={felt} stroke={edge} strokeWidth={1.3} />
                )}
              </g>
            )}
          </g>
        </g>
      ))}
    </g>
  )
}

/** Felt colours for anonymous plushes (the focus crowd): none of them GuildBot's own. */
export const CREW_TINTS = ['#4FB3A0', '#E58BB0', '#73A9E6', '#9CC55A', '#D9B07A', '#F08A6B', '#8E9BD8', '#58C1D6']

/** The dark felt edge for a colour: outlines and limb lines. */
export const plushEdge = (colour: PlushColour) => mix(PLUSH_COLOURS[colour], '#000000', 0.3)

/** Mix two hex colours: t = 0 gives a, 1 gives b. */
function mix(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
  const [x, y] = [p(a), p(b)]
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')
}

/** A small offset towards the pointer, for the pupils; zero when off or reduced motion. */
function useLookAt(on: boolean): { x: number; y: number } {
  const [look, setLook] = useState({ x: 0, y: 0 })
  const frame = useRef(0)
  useEffect(() => {
    if (!on) return
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const move = (e: PointerEvent) => {
      cancelAnimationFrame(frame.current)
      frame.current = requestAnimationFrame(() => {
        const dx = e.clientX / window.innerWidth - 0.85
        const dy = e.clientY / window.innerHeight - 0.85
        setLook({ x: Math.max(-3, Math.min(3, dx * 6)), y: Math.max(-2.5, Math.min(2.5, dy * 5)) })
      })
    }
    window.addEventListener('pointermove', move, { passive: true })
    return () => { window.removeEventListener('pointermove', move); cancelAnimationFrame(frame.current) }
  }, [on])
  return on ? look : { x: 0, y: 0 }
}
