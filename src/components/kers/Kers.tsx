'use client'

import { useContext, useEffect, useId, useRef, useState } from 'react'
import type { Expression, Wear } from '@guildboard/guildbot'
import { cn } from '@/lib/utils/cn'
import { Eye, KERS_COLOURS, eyeShape, mix, useLookAt, type KersColour } from '@/components/kers/look'
import { WearContext } from '@/components/guildbot/useWeather'
import { HIPS, RIGS, SHOULDERS, type KersPose, type Point, type Rig } from '@/components/kers/poses'
import type { CursorPlay } from '@/components/kers/useCursorPlay'

/**
 * Kers, GuildBot's character: the mouse cursor (↖) come to life as a
 * chubby little pet, drawn and animated in SVG. A puffy, squat arrowhead
 * (no stem, no tail) with short stick limbs, thin lines ending in round
 * hands and feet. Big googly eyes set low, stitched brows and blush; no
 * mouth. Depth from a soft drop shadow, a gradient, light on his
 * puffy top, lit round hands and feet, and a contact shadow.
 *
 * - Mood: his outline and limbs are always sumi, like a real cursor; his
 *   fill is the mood's Japanese dye (kuchiba on an ordinary day; genie
 *   ruri, meeting budo too). Under 24px he's a simple mark: the cursor in
 *   his fill with two dot eyes.
 * - Face: googly eyes (pupils follow the pointer) and stitched eyebrows.
 * - Cursor states, his quirk: a loader ring while he thinks, a blinking
 *   I-beam caret while he writes, a click ripple when he's pleased, a ⊘
 *   when he says no.
 * - Poses are rigs (poses.ts); motion is CSS (.gb-kers in globals.css) and
 *   stops under reduced motion.
 */
export type KersState = 'thinking' | 'writing' | 'pleased' | 'refusing' | null
export type KersMotion = 'idle' | 'walk' | 'hop' | 'dance' | 'still'
/** What he wears for what he's doing (the weather comes from WearContext). */
export type KersWear = 'headphones' | null

const SUMI = '#2B2B2B'
const W = 200
const H = 240

/** A closed path through the points, each corner rounded by its radius (a quadratic curve with the corner as control). */
function rounded(pts: Point[], radii: number[]): string {
  const n = pts.length
  let d = ''
  for (let i = 0; i < n; i++) {
    const [px, py] = pts[i]
    const [ax, ay] = pts[(i - 1 + n) % n]
    const [bx, by] = pts[(i + 1) % n]
    const la = Math.hypot(ax - px, ay - py)
    const lb = Math.hypot(bx - px, by - py)
    const r = Math.min(radii[i], la / 2, lb / 2)
    const p1 = [px + ((ax - px) / la) * r, py + ((ay - py) / la) * r]
    const p2 = [px + ((bx - px) / lb) * r, py + ((by - py) / lb) * r]
    d += `${i === 0 ? 'M' : 'L'}${p1[0].toFixed(1)} ${p1[1].toFixed(1)}Q${px} ${py} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
  }
  return d + 'Z'
}

// The cursor, chubby: tip, straight left edge, the bottom, a small stubby
// nub of a stem (part of him, not a tail), the step in under the wing, the wing.
// Corners puffed (well rounded), edges straight, the tip kept crisp.
const BODY = rounded(
  [[54, 48], [54, 200], [94, 164], [104, 189], [122, 182], [113, 152], [160, 152]],
  [9, 22, 6, 8, 8, 6, 15],
)
const OUTLINE = 8
// Where things sit on him: big eyes set low, and his cheeks.
const EYES: [Point, Point] = [[75, 126], [101, 126]]
const EYE_R = 13
const CHEEKS: [Point, Point] = [[63, 147], [99, 146]]
const TIP: Point = [57, 52]
const CENTRE: Point = [98, 136]
const WHITE = '#FFFFFF'

/** His fill: the mood's dye as a soft pastel (kuchiba becomes a light peach on an ordinary, smug day). */
export function fillDye(colour: KersColour): string {
  return pastel(KERS_COLOURS[colour])
}
const pastel = (hex: string) => mix(hex, '#FFFBF5', 0.6)

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
  className,
}: {
  pose?: KersPose
  colour?: KersColour
  expression?: Expression
  state?: KersState
  /** Height in px. */
  size?: number
  motion?: KersMotion
  follow?: boolean
  /** Any fill colour, for the anonymous cursors in the focus crowd. */
  tint?: string
  wear?: KersWear
  /** Reacting to your cursor (useCursorPlay): pointing, leaning in, flinching. */
  play?: CursorPlay
  className?: string
}) {
  const look = useLookAt(follow)
  const weather = useContext(WearContext)
  const walking = motion === 'walk' || pose === 'walk-a' || pose === 'walk-b'
  const jiggle = useJiggle(walking ? 'walk' : motion)
  const base = RIGS[motion === 'dance' ? 'arms-up' : pose]
  // Pointing: his left arm swings up toward whatever you're hovering.
  const rig = play === 'point' && !base.lying ? { ...base, hands: [[14, 112], base.hands[1]] as [Point, Point], wave: undefined } : base
  const dye = tint ? pastel(tint) : fillDye(colour)
  const face = rig.lying || rig.sleep ? 'relieved' : expression

  return (
    <span
      className={cn('gb-kers relative inline-block shrink-0', className)}
      style={{ width: (size * W) / H, height: size }}
      data-motion={walking ? 'walk' : motion}
      data-jiggle={jiggle ? '' : undefined}
      data-play={play ?? undefined}
    >
      <span className="gb-kers-body absolute inset-0">
        <svg viewBox={`0 0 ${W} ${H}`} className="absolute inset-0 w-full h-full overflow-visible" aria-hidden>
          {size < 24 ? (
            <Mark dye={dye} />
          ) : (
            <>
              <Figure rig={rig} dye={dye} face={face} look={look} weather={weather} wear={wear} />
              <States rig={rig} state={state} />
            </>
          )}
        </svg>
      </span>
    </span>
  )
}

/** A little jiggle when he stops walking or dancing, like a squishy toy settling. */
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

type Ink = { line: string; fill: string }

/** Him, layered back to front for depth. */
function Figure({ rig, dye, face, look, weather, wear }: {
  rig: Rig
  dye: string
  face: Expression
  look: { x: number; y: number }
  weather: Wear
  wear: KersWear
}) {
  const id = useId().replace(/:/g, '')
  const ink: Ink = { line: `url(#${id}-ink)`, fill: `url(#${id}-ball)` }
  const hip = (i: 0 | 1): Point => [HIPS[i][0], HIPS[i][1] + rig.dy]

  return (
    <g>
      <defs>
        <linearGradient id={`${id}-face`} gradientUnits="userSpaceOnUse" x1={52} y1={20} x2={150} y2={200}>
          <stop offset="0%" stopColor={mix(dye, '#FFFFFF', 0.35)} />
          <stop offset="60%" stopColor={mix(dye, '#F2EFEA', 0.06)} />
          <stop offset="100%" stopColor={mix(dye, '#5A5048', 0.16)} />
        </linearGradient>
        <linearGradient id={`${id}-ink`} gradientUnits="userSpaceOnUse" x1={30} y1={10} x2={170} y2={230}>
          <stop offset="0%" stopColor="#4A4A4A" />
          <stop offset="100%" stopColor="#1A1A1A" />
        </linearGradient>
        <radialGradient id={`${id}-ball`} cx="38%" cy="32%" r="70%">
          <stop offset="0%" stopColor={WHITE} />
          <stop offset="100%" stopColor="#DCD8D0" />
        </radialGradient>
        <filter id={`${id}-blur`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="5" /></filter>
        <filter id={`${id}-ground`} x="-30%" y="-200%" width="160%" height="500%"><feGaussianBlur stdDeviation="3.5" /></filter>
      </defs>

      {/* Contact shadow on the ground. */}
      <ellipse cx={86} cy={231} rx={rig.dy > 0 ? 62 : 48} ry={5.5} fill="#000" opacity={0.2} filter={`url(#${id}-ground)`} />
      {rig.prop === 'cushion' && <Cushion />}

      {/* Legs: thin lines down to round feet, behind the cursor's bottom edge. Tucked under the blanket when he's asleep. */}
      {!rig.lying && HIPS.map((_, i) => {
        const h = hip(i as 0 | 1)
        const f = rig.feet[i]
        return (
          <g key={i} className={`kx-leg-${i === 0 ? 'l' : 'r'}`} style={{ transformOrigin: `${h[0]}px ${h[1]}px` }}>
            <Noodle a={h} b={[f[0], f[1] - 4]} bend={i === 0 ? -0.18 : 0.18} ink={ink} />
            <Ball x={f[0]} y={f[1]} rx={14} ry={8.5} ink={ink} />
          </g>
        )
      })}

      <g className="kx-body" data-typing={rig.typing ? '' : undefined} transform={rig.lying ? `translate(0 ${rig.dy}) rotate(-16 100 200)` : `translate(0 ${rig.dy})${rig.tilt ? ` rotate(${rig.tilt} 100 205)` : ''}`}>
        {!rig.front && !rig.lying && <Arms rig={rig} ink={ink} />}

        {/* A soft drop shadow behind him for depth, then a thin white edge round his outline (so he reads on any background), then him. */}
        <path d={BODY} transform="translate(7 9)" fill="#000" stroke="#000" strokeWidth={OUTLINE} strokeLinejoin="round" opacity={0.16} filter={`url(#${id}-blur)`} />
        <path d={BODY} fill={WHITE} stroke={WHITE} strokeOpacity={0.85} strokeWidth={OUTLINE + 5} strokeLinejoin="round" />
        <path d={BODY} fill={`url(#${id}-face)`} stroke={ink.line} strokeWidth={OUTLINE} strokeLinejoin="round" />
        {/* Light on his puffy top: a soft glow and a shine along his straight edge. */}
        <ellipse cx={76} cy={90} rx={14} ry={26} fill={WHITE} opacity={0.4} filter={`url(#${id}-blur)`} />
        <path d="M62 74V184M68 64l50 50" stroke={WHITE} strokeWidth={3.2} strokeLinecap="round" fill="none" opacity={0.6} />

        <Face face={face} look={look} lid={dye} />
        <Gear weather={weather} wear={wear} asleep={!!rig.lying} />

        {rig.prop === 'laptop' && <Laptop />}
        {rig.prop === 'book' && <Book />}
        {rig.prop === 'mug' && <Mug />}
        {rig.front && <Arms rig={rig} ink={ink} />}
        {rig.prop === 'toothbrush' && <Toothbrush hand={rig.hands[1]} />}
      </g>
      {rig.prop === 'blanket' && <Blanket />}
    </g>
  )
}

/** A bendy noodle limb: a thin curved line (rubber-hose style), with a white edge so it reads on dark backgrounds. */
function Noodle({ a, b, bend, ink }: { a: Point; b: Point; bend: number; ink: Ink }) {
  const [mx, my] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  const [dx, dy] = [b[0] - a[0], b[1] - a[1]]
  const d = `M${a[0]} ${a[1]}Q${mx - dy * bend} ${my + dx * bend} ${b[0]} ${b[1]}`
  return (
    <>
      <path d={d} stroke={WHITE} strokeOpacity={0.85} strokeWidth={7.5} strokeLinecap="round" fill="none" />
      <path d={d} stroke={ink.line} strokeWidth={4} strokeLinecap="round" fill="none" />
    </>
  )
}

/** A round hand or foot: white, outlined, lit from the top left. */
function Ball({ x, y, rx, ry, ink }: { x: number; y: number; rx: number; ry: number; ink: Ink }) {
  return (
    <g>
      <ellipse cx={x} cy={y} rx={rx + 2} ry={ry + 2} fill={WHITE} opacity={0.85} />
      <ellipse cx={x} cy={y} rx={rx} ry={ry} fill={ink.fill} stroke={ink.line} strokeWidth={3} />
      <ellipse cx={x - rx * 0.35} cy={y - ry * 0.4} rx={rx * 0.32} ry={ry * 0.26} fill={WHITE} opacity={0.9} />
    </g>
  )
}

/** His two arms: thin lines from the cursor to round hands, pivoting where they join (CSS swings them). */
function Arms({ rig, ink }: { rig: Rig; ink: Ink }) {
  return (
    <>
      {SHOULDERS.map((s, i) => {
        const side = i === 0 ? 'left' : 'right'
        const h = rig.hands[i]
        return (
          <g key={side} className={rig.wave === side ? 'kx-wave' : `kx-arm-${side === 'left' ? 'l' : 'r'}`} style={{ transformOrigin: `${s[0]}px ${s[1]}px` }}>
            <Noodle a={s} b={h} bend={i === 0 ? 0.22 : -0.22} ink={ink} />
            <Ball x={h[0]} y={h[1]} rx={10} ry={10} ink={ink} />
          </g>
        )
      })}
    </>
  )
}

/** Under 24px, a simple mark: the cursor in his fill and two dot eyes. */
function Mark({ dye }: { dye: string }) {
  return (
    <g>
      <path d={BODY} fill={dye} stroke={SUMI} strokeWidth={OUTLINE + 4} strokeLinejoin="round" />
      <circle cx={EYES[0][0]} cy={EYES[0][1]} r={11} fill={SUMI} />
      <circle cx={EYES[1][0]} cy={EYES[1][1]} r={11} fill={SUMI} />
    </g>
  )
}

/** His face: big googly eyes set low, stitched brows and blush. No mouth. */
function Face({ face, look, lid }: { face: Expression; look: { x: number; y: number }; lid: string }) {
  const shape = eyeShape(face)
  const k = EYE_R / 12
  const brow = BROWS[face] ?? { lift: [0, 0] as [number, number], tilt: [0, 0] as [number, number] }
  const blush = face === 'proud' || face === 'relieved' || face === 'excited' ? 0.7 : 0.42
  return (
    <g>
      {CHEEKS.map(([x, y]) => (
        <ellipse key={x} cx={x} cy={y} rx={9} ry={5.5} fill="#FF7A6B" opacity={blush} />
      ))}
      {EYES.map(([x, y], side) => (
        <g key={side} transform={`translate(${x} ${y}) scale(${k})`}>
          {/* A googly eye is a little plastic dome: a soft shadow under it and a rim. */}
          {!shape.arcs && <circle cx={0.6} cy={1.6} r={shape.r + 0.8} fill="#000000" opacity={0.18} />}
          {!shape.arcs && <circle r={shape.r + 0.9} fill={WHITE} stroke="#8C8579" strokeWidth={0.8} />}
          <Eye cx={0} cy={0} shape={shape} side={side as 0 | 1} look={look} lid={lid} />
          <path
            d="M-11 0H11"
            transform={`translate(0 ${-shape.r - 7 - brow.lift[side]}) rotate(${brow.tilt[side]})`}
            stroke={SUMI}
            strokeWidth={2.6}
            strokeDasharray="3.4 2.2"
            strokeLinecap="round"
          />
        </g>
      ))}
    </g>
  )
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

/** Weather and activity gear, placed from his eyes and tip. */
function Gear({ weather, wear, asleep }: { weather: Wear; wear: KersWear; asleep: boolean }) {
  const [[lx, ly], [rx, ry]] = EYES
  const R = EYE_R
  const ey = (ly + ry) / 2
  const [tx, ty] = TIP
  return (
    <g>
      {weather.umbrella && !asleep && (
        <g className="gb-kers-float">
          <path d={`M${tx + 30} ${ty - 14}v40`} stroke="#3A3F4F" strokeWidth={3} strokeLinecap="round" />
          <path d={`M${tx - 26} ${ty - 6}Q${tx + 30} ${ty - 66} ${tx + 86} ${ty - 6}q-14-8-28 0-14-8-28 0-14-8-28 0-14-8-28 0Z`} fill="#3E7BFA" stroke="#1E2B57" strokeWidth={2} strokeLinejoin="round" />
        </g>
      )}
      {weather.beanie && (
        // A knitted cap pulled over his tip.
        <g transform={`translate(${tx + 6} ${ty + 12}) rotate(-14)`}>
          <path d="M-18 0C-17 -26 17 -26 18 0Z" fill="#2F3A56" />
          <rect x={-20} y={-3} width={40} height={8} rx={3.5} fill="#46557A" />
          <circle cx={0} cy={-21} r={5.5} fill="#E9E4DA" />
        </g>
      )}
      {wear === 'headphones' && (
        <g>
          <path d={`M${lx - R * 1.4} ${ey}C${lx - R * 1.4} ${ey - R * 3.6} ${rx + R * 1.4} ${ey - R * 3.6} ${rx + R * 1.4} ${ey}`} fill="none" stroke="#2A2F3D" strokeWidth={4} strokeLinecap="round" />
          <rect x={lx - R * 1.9} y={ey - R * 0.8} width={R * 0.9} height={R * 1.6} rx={R * 0.45} fill="#2A2F3D" />
          <rect x={rx + R * 1.0} y={ey - R * 0.8} width={R * 0.9} height={R * 1.6} rx={R * 0.45} fill="#2A2F3D" />
        </g>
      )}
      {weather.sunglasses && !weather.beanie && !asleep && (
        <g>
          <circle cx={lx} cy={ly} r={R * 1.15} fill="#121318" />
          <circle cx={rx} cy={ry} r={R * 1.15} fill="#121318" />
          <path d={`M${lx + R} ${ey}H${rx - R}`} stroke="#121318" strokeWidth={2.6} strokeLinecap="round" />
          <path d={`M${lx - 6} ${ly - 5}l5 -2.5M${rx - 6} ${ry - 5}l5 -2.5`} stroke="#FFFFFF" strokeOpacity={0.5} strokeWidth={1.8} strokeLinecap="round" />
        </g>
      )}
      {weather.scarf && (
        <g>
          <path d="M50 158q30 10 60 0l-2 8q-28 10-56 0Z" fill="#16774F" />
          <path d="M88 164l3 16h7l-3-17Z" fill="#16774F" />
        </g>
      )}
      {weather.sweat && !asleep && (
        <g className="gb-kers-sweat" fill="#8EC2FF">
          <path data-drop d="M128 96c3 4 4 6 4 7.5a4 4 0 0 1-8 0c0-1.5 1-3.5 4-7.5Z" />
          <path data-drop d="M38 88c2.5 3.4 3.4 5 3.4 6.3a3.4 3.4 0 0 1-6.8 0c0-1.3.9-2.9 3.4-6.3Z" />
        </g>
      )}
    </g>
  )
}

/** Props he holds, in his body's coordinates (the ground is at y 216 when he sits). */
function Laptop() {
  return (
    <g>
      <rect x={38} y={164} width={100} height={48} rx={5} fill="#5B6068" />
      <path d="M43 168h90" stroke="#7E848D" strokeWidth={2} strokeLinecap="round" />
      <path d="M88 184l3 3-3 3-3-3Z" fill="#E8913A" opacity={0.85} />
      <rect x={34} y={210} width={108} height={5} rx={2.5} fill="#43474E" />
    </g>
  )
}

function Book() {
  return (
    <g>
      <path d="M48 158l46 6v36l-46-6Z" fill="#B9B4AA" stroke="#8D877C" strokeWidth={1.5} strokeLinejoin="round" />
      <path d="M140 158l-46 6v36l46-6Z" fill="#C4BFB5" stroke="#8D877C" strokeWidth={1.5} strokeLinejoin="round" />
      <path d="M94 164v36" stroke="#8D877C" strokeWidth={2} />
      <path d="M52 156l42 5 42-5" stroke="#F4EFE6" strokeWidth={3} fill="none" />
    </g>
  )
}

function Mug() {
  return (
    <g>
      <path className="gb-kers-steam" d="M90 160c-3-4 3-6 0-10M98 160c-3-4 3-6 0-10" stroke="#BDB6AA" strokeWidth={2} fill="none" strokeLinecap="round" />
      <rect x={82} y={164} width={26} height={26} rx={5} fill="#4A6A8A" stroke="#33506B" strokeWidth={1.5} />
      <ellipse cx={95} cy={166} rx={11} ry={2.8} fill="#5A3A22" />
      <path d="M86 170v14" stroke="#FFFFFF" strokeOpacity={0.3} strokeWidth={3} strokeLinecap="round" />
    </g>
  )
}

/** Asleep: a striped blanket pulled up over his lap, on the ground. */
function Blanket() {
  return (
    <g>
      <path d="M22 192Q100 172 182 186L186 228Q100 238 18 228Z" fill="#6E86B8" stroke="#2B2B2B" strokeWidth={3} strokeLinejoin="round" />
      <path d="M22 204Q100 186 183 199M20 217Q100 202 185 213" stroke="#9AB0DA" strokeWidth={5} fill="none" strokeLinecap="round" />
    </g>
  )
}

function Cushion() {
  return (
    <g>
      <ellipse cx={92} cy={224} rx={68} ry={14} fill="#A9513A" />
      <ellipse cx={92} cy={219} rx={64} ry={10} fill="#C76A4E" />
      <ellipse cx={78} cy={215} rx={26} ry={3.2} fill="#FFFFFF" opacity={0.2} />
    </g>
  )
}

/** Brushing: a toothbrush in his hand, scrubbing just under his eyes, with a little foam. */
function Toothbrush({ hand }: { hand: Point }) {
  return (
    <g className="gb-kers-brush">
      <path d={`M${hand[0]} ${hand[1]}L102 162`} stroke="#3E7BFA" strokeWidth={4.5} strokeLinecap="round" />
      <rect x={92} y={157} width={11} height={7} rx={2} fill="#F3F1EC" stroke="#C9CED6" strokeWidth={1.2} />
      <circle cx={89} cy={161} r={3.2} fill="#FFFFFF" stroke="#E2E2E2" strokeWidth={0.8} />
      <circle cx={85} cy={166} r={2.3} fill="#FFFFFF" stroke="#E2E2E2" strokeWidth={0.8} />
    </g>
  )
}

/** His cursor states, around him. */
function States({ rig, state }: { rig: Rig; state: KersState }) {
  if (!state) return null
  const [tx, ty] = [TIP[0], TIP[1] + rig.dy]
  if (state === 'thinking') {
    const r = 112
    const c = 2 * Math.PI * r
    return <circle className="gb-kers-spin" cx={CENTRE[0]} cy={CENTRE[1] + rig.dy} r={r} fill="none" stroke={SUMI} strokeOpacity={0.3} strokeWidth={5} strokeLinecap="round" strokeDasharray={`${c * 0.22} ${c * 0.78}`} />
  }
  if (state === 'writing') {
    return <path className="gb-kers-caret" d="M176 96v40M169 96h14M169 136h14" stroke={SUMI} strokeWidth={4} strokeLinecap="round" fill="none" />
  }
  if (state === 'pleased') {
    return (
      <g className="gb-kers-ripple" fill="none" stroke={SUMI} strokeWidth={3}>
        <circle cx={tx} cy={ty} r={12} />
        <circle cx={tx} cy={ty} r={12} />
      </g>
    )
  }
  return (
    <g transform={`translate(${tx - 4} ${ty - 4})`}>
      <circle r={15} fill="#FFFFFF" stroke="#B7282E" strokeWidth={4} />
      <path d="M-10 10L10 -10" stroke="#B7282E" strokeWidth={4} strokeLinecap="round" />
    </g>
  )
}
