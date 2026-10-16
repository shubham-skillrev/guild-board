'use client'

import { useContext, useEffect, useId, useRef, useState } from 'react'
import type { Expression, Mood } from '@guildboard/guildbot'
import { cn } from '@/lib/utils/cn'
import { WearContext } from '@/components/guildbot/useWeather'

/**
 * Nibble, GuildBot's character: a crocheted computer mouse that is also a
 * mouse. (A nibble is four bits, half a byte: he's the little one next to
 * Bytes.) "GuildBot" stays the product; Nibble is what he's called.
 *
 * - The mouse: his click buttons are his ears, the scroll wheel is his nose
 *   (whiskers stitched either side), the cable is his tail, with a USB plug.
 *   Upright and chubby: a broad top of two round button-lobes, never a
 *   point, near-straight sides, a flat bottom to sit on.
 * - Clicky ears: a button dips with a click when he smirks or is pleased,
 *   both when he's shocked. His one quirk.
 * - Crochet: rows of little V stitches, a bumpy stitched edge, shading that
 *   sags toward the bottom, a care tag; sewn-on stub arms and round feet.
 *   Below 48px he's a plain silhouette (no stitches, whiskers or limbs).
 * - Yarn: the whole body is his mood in a traditional Japanese dye (smug
 *   kuchiba, bored nezumi-iro, which means "mouse colour", dramatic akane,
 *   proud yamabuki), with two moments (genie ruri, meeting sulk budo). The
 *   nose, seam and cable are always sumi charcoal; the plug kinu cream. In
 *   dark mode a lamp catches his top edge.
 * - Googly eyes, nothing else on his face; dressed by the weather and by
 *   what he's doing.
 *
 * Motion lives in globals.css (.gb-plush) and stops under reduced motion.
 */
export type PlushColour = Mood | 'genie' | 'meeting'
export type PlushMotion = 'idle' | 'hop' | 'dance' | 'stretch' | 'walk' | 'still'
/** His arms: both at his sides (rest), only the left (a scene gives him the right), none, or a job. */
export type PlushHands = 'rest' | 'one' | 'none' | 'typing' | 'mug' | 'wave' | 'brush'
export type PlushWear = 'headphones' | 'sleepmask'
/** Which button-ear is pressed. */
export type EarClick = 'left' | 'right' | 'both' | null

/** His yarns: traditional Japanese dyes. */
export const PLUSH_COLOURS: Record<PlushColour, string> = {
  smug: '#E2943B',     // kuchiba, fallen-leaf orange (the app's saffron)
  bored: '#949495',    // nezumi-iro, "mouse colour"
  dramatic: '#B7282E', // akane, madder red
  proud: '#F8B500',    // yamabuki, golden
  genie: '#1E50A2',    // ruri, lapis
  meeting: '#6C3A5C',  // budo, grape
}

/** Sumi charcoal (nose, seam, cable) and kinu cream (the plug). */
const SUMI = '#2B2B2B'
const KINU = '#F3EBDD'

// The mouse, standing: two round button-lobes on top with a notch between
// them, near-straight sides, a flat bottom.
const BODY = 'M24 94H76C83 94 88 89 88 82C89.5 70 89.5 56 88 44C87 24 79 12 66 12C59 12 54 15 50 19C46 15 41 12 34 12C21 12 13 24 12 44C10.5 56 10.5 70 12 82C12 89 17 94 24 94Z'
// The two buttons (his ears), down to the edge where the buttons meet the palm.
const EAR_L = 'M50 19C46 15 41 12 34 12C21 12 13 24 12 44C11.4 50 11 55 11 60Q30 66 50 66Z'
const EAR_R = 'M50 19C54 15 59 12 66 12C79 12 87 24 88 44C88.6 50 89 55 89 60Q70 66 50 66Z'
const EYE_Y = 34

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
  /** Crochet stitches and the care tag: off below 48px. */
  fuzzy?: boolean
  /** Stub arms, feet, whiskers and tail. Off for marks too small to read them. */
  limbs?: boolean
  /** Any yarn colour, for the anonymous mice in the focus crowd. */
  tint?: string
  /** Press an ear now (the character sheet). Otherwise his ears click on their own as his face changes. */
  click?: EarClick
  look?: { x: number; y: number }
}

/** Nibble on his own, sized in px. */
export function PlushBot({
  size = 80,
  motion = 'idle',
  follow = false,
  className,
  limbs,
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
        <PlushFigure {...figure} fuzzy={size >= 48} limbs={limbs ?? size >= 48} look={look} />
      </svg>
    </span>
  )
}

/**
 * Nibble as SVG, for scenes to place: drawn in a -10 -14 120 120 box, body
 * from (11, 12) to (89, 94), feet on y 103. Wrap it in a <g> with
 * `.gb-plush` and `data-motion` on an ancestor to animate it.
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
  click,
  look = { x: 0, y: 0 },
}: FigureProps) {
  const id = useId().replace(/:/g, '')
  const base = tint ?? PLUSH_COLOURS[colour]
  const weather = useContext(WearContext)
  const eyes = eyeShape(expression)
  const limbs = withLimbs ? limbsFor(hands) : []
  const auto = useEarClick(expression)
  const pressed = click === undefined ? auto : click
  const edge = mix(base, '#000000', 0.3)
  const thread = mix(base, '#000000', 0.24)
  // Costumes were drawn for a head at y 11, eyes at y 42 and a neck at y 55.
  const atTop = 'translate(0 3)'
  const atEyes = `translate(0 ${EYE_Y - 42})`
  const atNeck = 'translate(0 8)'

  return (
    <g>
      <defs>
        <radialGradient id={`${id}-yarn`} gradientUnits="userSpaceOnUse" cx={40} cy={30} r={72}>
          <stop offset="0%" stopColor={mix(base, '#FFFFFF', 0.32)} />
          <stop offset="50%" stopColor={base} />
          <stop offset="100%" stopColor={mix(base, '#000000', 0.12)} />
        </radialGradient>
        {/* Where a stuffed toy sags: a soft shadow pooling at the bottom. */}
        <linearGradient id={`${id}-sag`} gradientUnits="userSpaceOnUse" x1={0} y1={50} x2={0} y2={96}>
          <stop offset="0%" stopColor="#000000" stopOpacity={0} />
          <stop offset="100%" stopColor="#000000" stopOpacity={0.18} />
        </linearGradient>
        {/* A desk lamp catching his top edge (dark mode only, see globals.css). */}
        <linearGradient id={`${id}-rim`} gradientUnits="userSpaceOnUse" x1={0} y1={14} x2={0} y2={44}>
          <stop offset="0%" stopColor="#FFD9A0" stopOpacity={0.8} />
          <stop offset="100%" stopColor="#FFD9A0" stopOpacity={0} />
        </linearGradient>
        {fuzzy && (
          // Crochet: columns of little V stitches, the way amigurumi is worked.
          <pattern id={`${id}-stitch`} width={4} height={3.6} patternUnits="userSpaceOnUse">
            <path d="M0.5 0.4L2 3L3.5 0.4" fill="none" stroke={thread} strokeOpacity={0.38} strokeWidth={0.7} strokeLinecap="round" strokeLinejoin="round" />
            <path d="M0.9 0.7L2 2.5" fill="none" stroke="#FFFFFF" strokeOpacity={0.2} strokeWidth={0.6} strokeLinecap="round" />
          </pattern>
        )}
      </defs>

      {/* Shadow on whatever he sits on. */}
      <ellipse className="gb-plush-shadow" cx={50} cy={104} rx={28} ry={3.4} fill="#000" opacity={0.18} />

      {weather.umbrella && (
        <g className="gb-plush-float-prop">
          <path d="M50 -10v26" stroke="#3A3F4F" strokeWidth={2.2} strokeLinecap="round" />
          <path d="M14 -2Q50 -34 86 -2q-9-5-18 0-9-5-18 0-9-5-18 0-9-5-18 0Z" fill="#3E7BFA" stroke="#1E2B57" strokeWidth={1.6} strokeLinejoin="round" />
        </g>
      )}

      <g className="gb-plush-body">
        {withLimbs && <Tail />}
        <Limbs limbs={limbs} base={base} edge={edge} layer="back" />

        {/* The body, then the two button-ears over it (they click). */}
        <path d={BODY} fill={`url(#${id}-yarn)`} />
        <path d={EAR_L} fill={`url(#${id}-yarn)`} className="gb-ear" data-pressed={pressed === 'left' || pressed === 'both' ? '' : undefined} />
        <path d={EAR_R} fill={`url(#${id}-yarn)`} className="gb-ear" data-pressed={pressed === 'right' || pressed === 'both' ? '' : undefined} />
        {fuzzy && <path d={BODY} fill={`url(#${id}-stitch)`} />}
        <path d={BODY} fill={`url(#${id}-sag)`} />
        {/* A bumpy stitched edge. */}
        {fuzzy && <path d={BODY} fill="none" stroke={mix(base, '#000000', 0.08)} strokeWidth={2.2} strokeDasharray="1.8 1.6" strokeLinecap="round" />}
        <path d={BODY} fill="none" stroke={`url(#${id}-rim)`} strokeWidth={2.4} className="gb-plush-rim" />
        {/* The button seam, in sumi: down between the ears, across where they meet the palm. */}
        <path d="M50 19V40M11 60Q50 72 89 60" fill="none" stroke={SUMI} strokeOpacity={0.45} strokeWidth={1.3} strokeLinecap="round" />
        <ellipse cx={33} cy={20} rx={9} ry={3.6} fill="#FFFFFF" opacity={0.2} transform="rotate(-18 33 20)" />
        {fuzzy && <Tag />}

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
            <rect x={4} y={30} width={12} height={20} rx={6} fill="#2A2F3D" />
            <rect x={84} y={30} width={12} height={20} rx={6} fill="#2A2F3D" />
          </g>
        )}

        {/* Googly eyes: white, a black pupil that wanders, a felt lid. */}
        <g className="gb-plush-eyes">
          {[33, 67].map((cx, side) => (
            <Eye key={cx} cx={cx} cy={EYE_Y} shape={eyes} side={side as 0 | 1} look={look} lid={base} />
          ))}
        </g>

        {/* His nose: the scroll wheel, whiskers stitched either side. */}
        {withLimbs && (
          <path d="M44 48.5L31 45.5M44 51.5L31 53.5M56 48.5L69 45.5M56 51.5L69 53.5" stroke={SUMI} strokeOpacity={0.5} strokeWidth={1} strokeLinecap="round" />
        )}
        <g>
          <rect x={46.5} y={43} width={7} height={11} rx={3.5} fill={SUMI} />
          <path d="M48.3 46.5h3.4M48.3 49h3.4M48.3 51.5h3.4" stroke="#5A5A5A" strokeWidth={0.9} strokeLinecap="round" />
          <ellipse cx={48.6} cy={45} rx={1} ry={0.7} fill="#FFFFFF" opacity={0.5} />
        </g>

        {wear === 'sleepmask' && (
          <g transform={atEyes}>
            <rect x={12} y={33} width={76} height={18} rx={9} fill="#3B4A7A" />
            <path d="M25 43q7 4 14 0M61 43q7 4 14 0" stroke="#E9E4DA" strokeWidth={2} fill="none" strokeLinecap="round" />
          </g>
        )}
        {weather.sunglasses && !weather.beanie && wear !== 'sleepmask' && (
          <g transform={atEyes}>
            <circle cx={32} cy={42} r={13.5} fill="#121318" />
            <circle cx={68} cy={42} r={13.5} fill="#121318" />
            <path d="M45 41h10M18.5 39l-11-4M81.5 39l11-4" stroke="#121318" strokeWidth={2.6} strokeLinecap="round" />
            <path d="M26 36l5-2.5M62 36l5-2.5" stroke="#FFFFFF" strokeOpacity={0.5} strokeWidth={1.8} strokeLinecap="round" />
          </g>
        )}
        {weather.scarf && (
          <g transform={atNeck}>
            <path d="M8 55q42 15 84 0l-3 8q-39 14-78 0Z" fill="#16774F" />
            <path d="M64 64l2 16h7l-2-17Z" fill="#16774F" />
          </g>
        )}
        <Limbs limbs={limbs} base={base} edge={edge} layer="front" />
      </g>

      {weather.sweat && (
        <g className="gb-plush-sweat" fill="#8EC2FF" transform={atTop}>
          <path data-drop d="M10 20c2 2.8 2.8 4.2 2.8 5.4a2.8 2.8 0 0 1-5.6 0c0-1.2.8-2.6 2.8-5.4Z" />
          <path data-drop d="M92 24c1.8 2.4 2.4 3.6 2.4 4.6a2.4 2.4 0 0 1-4.8 0c0-1 .6-2.2 2.4-4.6Z" />
        </g>
      )}

      {status === 'thinking' && (
        <g className="gb-plush-status" fill="#8A8F9C">
          <circle data-dot cx={88} cy={10} r={3} />
          <circle data-dot cx={96} cy={0} r={4} />
          <circle data-dot cx={105} cy={-10} r={5} />
        </g>
      )}
      {status === 'talking' && (
        <g className="gb-plush-status" fill="none" stroke="#8A8F9C" strokeWidth={2.4} strokeLinecap="round">
          <path data-wave d="M98 40q4 8 0 16" />
          <path data-wave d="M105 34q6 14 0 28" />
        </g>
      )}
    </g>
  )
}

/** His ears click on their own: one when he's pleased with himself, both when he's shocked. */
function useEarClick(expression: Expression): EarClick {
  const [pressed, setPressed] = useState<EarClick>(null)
  const last = useRef(expression)
  useEffect(() => {
    if (last.current === expression) return
    last.current = expression
    const which: EarClick = expression === 'dramatic' || expression === 'excited' ? 'both'
      : expression === 'smug' || expression === 'proud' || expression === 'nosy' ? 'right'
      : null
    if (!which) return
    const on = setTimeout(() => setPressed(which), 0)
    const off = setTimeout(() => setPressed(null), 260)
    return () => { clearTimeout(on); clearTimeout(off) }
  }, [expression])
  return pressed
}

/** The cable, curling out behind him, ending in a USB plug. It wags. */
function Tail() {
  return (
    <g className="gb-tail">
      <path d="M80 91C95 99 104 93 103 83C102 75 105 70 109 69" fill="none" stroke={SUMI} strokeWidth={2.6} strokeLinecap="round" />
      <g transform="translate(109 69) rotate(-20)">
        <rect x={0} y={-3} width={7} height={6} rx={1.4} fill={KINU} stroke={SUMI} strokeOpacity={0.5} strokeWidth={0.7} />
        <rect x={6.4} y={-2} width={3.6} height={4} rx={0.6} fill="#B9BEC6" />
      </g>
    </g>
  )
}

/** The care tag every soft toy has, sewn into a side seam. */
function Tag() {
  return (
    <g transform="translate(12.5 86) scale(-1 1) rotate(-10)">
      <path d="M0 -3.5h9a1.5 1.5 0 0 1 1.5 1.5v4a1.5 1.5 0 0 1-1.5 1.5H0Z" fill="#FBF6EC" stroke="#000000" strokeOpacity={0.15} strokeWidth={0.6} />
      <path d="M3 -1h5M3 1.2h3.5" stroke="#E8913A" strokeWidth={0.9} strokeLinecap="round" />
    </g>
  )
}

/** A crocheted hand, for scenes that hand him things (chopsticks, a book): the round end of a stub arm. */
export function Mitten({ x, y, colour = 'smug', flip = false, rot = 0, scale = 0.55 }: { x: number; y: number; colour?: PlushColour; flip?: boolean; rot?: number; scale?: number }) {
  const base = PLUSH_COLOURS[colour]
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(${flip ? -scale : scale} ${scale})`}>
      <circle r={6} fill={base} stroke={mix(base, '#000000', 0.3)} strokeWidth={1.3} />
      <ellipse cx={-1.8} cy={-2.2} rx={2.2} ry={1.3} fill="#FFFFFF" opacity={0.35} />
    </g>
  )
}

export type EyeShape = {
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

export function eyeShape(e: Expression): EyeShape {
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

export function Eye({ cx, cy, shape, side, look, lid }: { cx: number; cy: number; shape: EyeShape; side: 0 | 1; look: { x: number; y: number }; lid: string }) {
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
  /** Shoulder or hip, where it's sewn on (and pivots). */
  at: [number, number]
  /** Where the hand or foot ends up, from there. */
  to: [number, number]
  kind: 'hand' | 'foot'
  /** Animation class: the pivot rotates or shifts the whole limb. */
  cls: string
  /** In front of the body (typing, holding things up) rather than behind it. */
  front?: boolean
  /** Something held, drawn around the hand. */
  holding?: React.ReactNode
}

/** Where his arms are sewn on, for scenes that draw his hands themselves. */
export const SHOULDER_L: [number, number] = [14, 62]
export const SHOULDER_R: [number, number] = [86, 62]

/** Stub arms and round feet, crocheted and sewn on, posed for the job. */
function limbsFor(hands: PlushHands): Limb[] {
  const restL: Limb = { at: SHOULDER_L, to: [-11, 13], kind: 'hand', cls: 'gb-arm-l' }
  const restR: Limb = { at: SHOULDER_R, to: [11, 13], kind: 'hand', cls: 'gb-arm-r' }
  const feet: Limb[] = [
    { at: [36, 90], to: [-2, 9], kind: 'foot', cls: 'gb-leg-l', front: true },
    { at: [64, 90], to: [2, 9], kind: 'foot', cls: 'gb-leg-r', front: true },
  ]
  const arms: Limb[] = (() => {
    switch (hands) {
      case 'none': return []
      case 'one': return [restL]
      case 'rest': return [restL, restR]
      case 'typing':
        return [
          { at: SHOULDER_L, to: [20, 20], kind: 'hand', cls: 'gb-mitten-l', front: true },
          { at: SHOULDER_R, to: [-20, 20], kind: 'hand', cls: 'gb-mitten-r', front: true },
        ]
      case 'wave': return [restL, { at: SHOULDER_R, to: [12, -24], kind: 'hand', cls: 'gb-mitten-wave' }]
      case 'mug':
        return [restL, {
          at: SHOULDER_R, to: [6, 14], kind: 'hand', cls: 'gb-mitten-mug', front: true,
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
          at: SHOULDER_R, to: [2, 10], kind: 'hand', cls: 'gb-mitten-brush', front: true,
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
  return [...arms, ...feet]
}

/** The limbs for one layer: behind the body (sewn on at the sides) or in front of it. */
function Limbs({ limbs, base, edge, layer }: { limbs: Limb[]; base: string; edge: string; layer: 'back' | 'front' }) {
  const shown = limbs.filter(l => !!l.front === (layer === 'front'))
  if (!shown.length) return null
  return (
    <g>
      {shown.map(l => (
        <g key={l.cls} transform={`translate(${l.at[0]} ${l.at[1]})`}>
          <g className={l.cls}>
            {/* The stub: a soft tube of yarn, outlined. */}
            <path d={`M0 0L${l.to[0]} ${l.to[1]}`} stroke={edge} strokeWidth={10.4} strokeLinecap="round" />
            <path d={`M0 0L${l.to[0]} ${l.to[1]}`} stroke={base} strokeWidth={8} strokeLinecap="round" />
            <g transform={`translate(${l.to[0]} ${l.to[1]})`}>
              {l.holding}
              {l.kind === 'hand' ? (
                <>
                  <circle r={6} fill={base} stroke={edge} strokeWidth={1.3} />
                  <ellipse cx={-1.8} cy={-2.2} rx={2.2} ry={1.3} fill="#FFFFFF" opacity={0.3} />
                </>
              ) : (
                // A round crochet foot, a sole in sumi.
                <>
                  <ellipse cx={0} cy={0} rx={9} ry={5.2} fill={base} stroke={edge} strokeWidth={1.3} />
                  <ellipse cx={0} cy={2.2} rx={6} ry={2} fill={SUMI} opacity={0.18} />
                </>
              )}
            </g>
          </g>
        </g>
      ))}
    </g>
  )
}

/** Yarn colours for the anonymous mice in the focus crowd: Japanese dyes, none of them his. */
export const CREW_TINTS = ['#68BE8D', '#F09199', '#00A3AF', '#AACF53', '#A0D8EF', '#5654A2', '#2F9F6E', '#B1959B']

/** The dark yarn edge for a colour: outlines and limb lines. */
export const plushEdge = (colour: PlushColour) => mix(PLUSH_COLOURS[colour], '#000000', 0.3)

/** Mix two hex colours: t = 0 gives a, 1 gives b. */
export function mix(a: string, b: string, t: number): string {
  const p = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16))
  const [x, y] = [p(a), p(b)]
  return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')
}

/** A small offset towards the pointer, for the pupils; zero when off or reduced motion. */
export function useLookAt(on: boolean): { x: number; y: number } {
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
