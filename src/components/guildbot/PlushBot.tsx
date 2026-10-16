'use client'

import { useContext, useEffect, useId, useRef, useState } from 'react'
import type { Expression, Mood } from '@guildboard/guildbot'
import { cn } from '@/lib/utils/cn'
import { WearContext } from '@/components/guildbot/useWeather'

/**
 * GuildBot as a plush toy: the board's ◈ as a soft, bottom-heavy felt
 * diamond that sits, with googly eyes and nothing else on his face.
 *
 * - Colour is his mood for the month (smug saffron, bored lilac, dramatic
 *   tomato, proud gold), with two moments of their own: genie blue for the
 *   last three asks, plum while he sulks about the meeting. It changes
 *   slowly; quick reactions show in his eyes and squash, never his colour.
 * - No limbs. He moves like a toy (squash, hop, wiggle, stretch tall), and
 *   when a job needs hands, two felt mittens float in: typing, a mug, a
 *   wave, the toothbrush.
 * - Dressed by the weather in your city and by what he's doing (headphones,
 *   a sleep mask); there is no outfit he always wears.
 * - Felt is drawn in SVG: soft shading, a fuzzy edge and grain. The fuzz is
 *   skipped when he's small, where it would only cost frames.
 *
 * Motion lives in globals.css (.gb-plush) and stops under reduced motion.
 */
export type PlushColour = Mood | 'genie' | 'meeting'
export type PlushMotion = 'idle' | 'hop' | 'dance' | 'stretch' | 'walk' | 'still'
/** His arms: both at his sides (rest), only the left (a scene gives him the right), none, or a job. */
export type PlushHands = 'rest' | 'one' | 'none' | 'typing' | 'mug' | 'wave' | 'brush'
export type PlushWear = 'headphones' | 'sleepmask'

export const PLUSH_COLOURS: Record<PlushColour, string> = {
  smug: '#F2913A',
  bored: '#B6A2E6',
  dramatic: '#EE5440',
  proud: '#F6C431',
  genie: '#3E7BFA',
  meeting: '#7D3F7D',
}

/** The diamond: soft corners, the bottom rounder and wider so he sits. */
// A soft kite: rounded peak, wide low shoulders, a short soft point below.
// Bottom-heavy, so he sits.
const BODY = 'M50 8C57 8 62 14 69 25C79 40 93 54 93 67C93 79 70 89 50 94C30 89 7 79 7 67C7 54 21 40 31 25C38 14 43 8 50 8Z'

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
  /** Any felt colour, for the anonymous plushes in the focus building's windows. */
  tint?: string
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
 * body from about (8, 9) to (92, 94), sitting on y 96. Wrap it in a <g>
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
  look = { x: 0, y: 0 },
}: FigureProps) {
  const id = useId().replace(/:/g, '')
  const base = tint ?? PLUSH_COLOURS[colour]
  const weather = useContext(WearContext)
  const eyes = eyeShape(expression)
  const limbs = withLimbs ? limbsFor(hands) : []

  return (
    <g>
        <defs>
          <radialGradient id={`${id}-felt`} cx="38%" cy="30%" r="78%">
            <stop offset="0%" stopColor={mix(base, '#FFFFFF', 0.32)} />
            <stop offset="55%" stopColor={base} />
            <stop offset="100%" stopColor={mix(base, '#000000', 0.28)} />
          </radialGradient>
          <radialGradient id={`${id}-sheen`}>
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity={0.45} />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity={0} />
          </radialGradient>
          {fuzzy && (
            <filter id={`${id}-fuzz`} x="-10%" y="-10%" width="120%" height="120%">
              {/* A ragged, furry edge... */}
              <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" result="noise" />
              <feDisplacementMap in="SourceGraphic" in2="noise" scale="3.2" xChannelSelector="R" yChannelSelector="G" result="furry" />
              {/* ...and fine felt grain on the surface. */}
              <feTurbulence type="fractalNoise" baseFrequency="2.2" numOctaves="1" seed="3" result="grain" />
              <feColorMatrix in="grain" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.16 0" result="grainAlpha" />
              <feComposite in="grainAlpha" in2="furry" operator="in" result="grainOnBody" />
              <feMerge><feMergeNode in="furry" /><feMergeNode in="grainOnBody" /></feMerge>
            </filter>
          )}
        </defs>

        {/* Shadow on whatever he sits on. */}
        <ellipse className="gb-plush-shadow" cx={50} cy={101} rx={30} ry={4} fill="#000" opacity={0.18} />

        {weather.umbrella && (
          <g className="gb-plush-float-prop">
            <path d="M50 -10v26" stroke="#3A3F4F" strokeWidth={2.2} strokeLinecap="round" />
            <path d="M14 -2Q50 -34 86 -2q-9-5-18 0-9-5-18 0-9-5-18 0-9-5-18 0Z" fill="#3E7BFA" stroke="#1E2B57" strokeWidth={1.6} strokeLinejoin="round" />
          </g>
        )}

        <g className="gb-plush-body">
          {/* Limb lines go behind him, so they seem to come out of the felt. */}
          <Limbs limbs={limbs} colour={base} layer="lines" />
          <path d={BODY} fill={`url(#${id}-felt)`} filter={fuzzy ? `url(#${id}-fuzz)` : undefined} />
          {/* A soft patch of light on the top facet, like a lamp on felt. */}
          <ellipse cx={40} cy={27} rx={11} ry={6} fill={`url(#${id}-sheen)`} transform="rotate(-38 40 27)" />

          {weather.beanie && (
            <g>
              <path d="M30 30C34 12 66 12 70 30Z" fill="#2F3A56" />
              <path d="M28 28h44v6H28Z" fill="#46557A" rx={3} />
              <circle cx={50} cy={10} r={5} fill="#E9E4DA" />
            </g>
          )}
          {wear === 'headphones' && (
            <g>
              <path d="M24 46C24 18 76 18 76 46" fill="none" stroke="#2A2F3D" strokeWidth={4.5} strokeLinecap="round" />
              <rect x={16} y={40} width={12} height={20} rx={6} fill="#2A2F3D" />
              <rect x={72} y={40} width={12} height={20} rx={6} fill="#2A2F3D" />
            </g>
          )}

          {/* Googly eyes: white, a black pupil that wanders, a felt lid. */}
          <g className="gb-plush-eyes">
            {[34, 66].map((cx, side) => (
              <Eye key={cx} cx={cx} cy={51} shape={eyes} side={side as 0 | 1} look={look} lid={base} />
            ))}
          </g>

          {wear === 'sleepmask' && (
            <g>
              <rect x={17} y={42} width={66} height={18} rx={9} fill="#3B4A7A" />
              <path d="M27 52q7 4 14 0M59 52q7 4 14 0" stroke="#E9E4DA" strokeWidth={2} fill="none" strokeLinecap="round" />
            </g>
          )}
          {weather.sunglasses && !weather.beanie && wear !== 'sleepmask' && (
            <g>
              <circle cx={34} cy={51} r={13.5} fill="#121318" />
              <circle cx={66} cy={51} r={13.5} fill="#121318" />
              <path d="M47 50h6M20.5 48l-7-3M79.5 48l7-3" stroke="#121318" strokeWidth={2.6} strokeLinecap="round" />
              <path d="M28 45l5-2.5M60 45l5-2.5" stroke="#FFFFFF" strokeOpacity={0.5} strokeWidth={1.8} strokeLinecap="round" />
            </g>
          )}
          {weather.scarf && (
            <g>
              <path d="M20 66q30 14 60 0l3 7q-33 15-66 0Z" fill="#16774F" />
              <path d="M62 76l2 14h7l-2-15Z" fill="#16774F" />
            </g>
          )}
          <Limbs limbs={limbs} colour={base} layer="ends" />
        </g>

        {weather.sweat && (
          <g className="gb-plush-sweat" fill="#8EC2FF">
            <path data-drop d="M16 30c2 2.8 2.8 4.2 2.8 5.4a2.8 2.8 0 0 1-5.6 0c0-1.2.8-2.6 2.8-5.4Z" />
            <path data-drop d="M86 36c1.8 2.4 2.4 3.6 2.4 4.6a2.4 2.4 0 0 1-4.8 0c0-1 .6-2.2 2.4-4.6Z" />
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

const SHOULDER_L: [number, number] = [18, 62]
const SHOULDER_R: [number, number] = [82, 62]

/**
 * Rayman rules: hands and feet float off the body, joined by the faintest
 * line, so walking and dancing read as walking and dancing.
 */
function limbsFor(hands: PlushHands): Limb[] {
  const restL: Limb = { at: SHOULDER_L, to: [-18, 14], kind: 'hand', cls: 'gb-arm-l' }
  const restR: Limb = { at: SHOULDER_R, to: [18, 14], kind: 'hand', cls: 'gb-arm-r' }
  const feet: Limb[] = [
    { at: [38, 84], to: [-8, 15], kind: 'foot', cls: 'gb-leg-l' },
    { at: [62, 84], to: [8, 15], kind: 'foot', cls: 'gb-leg-r' },
  ]
  const arms: Limb[] = (() => {
    switch (hands) {
      case 'none': return []
      case 'one': return [restL]
      case 'rest': return [restL, restR]
      case 'typing':
        return [
          { at: SHOULDER_L, to: [16, 30], kind: 'hand', cls: 'gb-mitten-l' },
          { at: SHOULDER_R, to: [-16, 30], kind: 'hand', cls: 'gb-mitten-r' },
        ]
      case 'wave': return [restL, { at: SHOULDER_R, to: [14, -28], kind: 'hand', cls: 'gb-mitten-wave' }]
      case 'mug':
        return [restL, {
          at: SHOULDER_R, to: [11, 12], kind: 'hand', cls: 'gb-mitten-mug',
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
          at: SHOULDER_R, to: [8, 10], kind: 'hand', cls: 'gb-mitten-brush',
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
