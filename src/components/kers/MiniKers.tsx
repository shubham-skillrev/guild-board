'use client'

import { useEffect, useId, useState } from 'react'
import { cn } from '@/lib/utils/cn'
import { mix, useLookAt } from '@/components/kers/look'
import type { Point } from '@/components/kers/poses'

/**
 * Kers's body and face (after grokbots.ai, but his own): one soft shape in a
 * fixed mint gradient, two round-ish eyes cut out of it (they show a
 * near-black layer behind), each with a shine, set low and close, and
 * nothing else. Every expression lives in the eyes: size, squash, offset
 * and a slanted lid. No limbs: he acts with his whole body. Mood shows only
 * as a blush, and only for strong moods.
 *
 * BlobFigure draws him in a -125..125 box (body about ±100); Kers wraps it
 * with poses, gear and cursor states. MiniKers is the bare figure, for the
 * shape comparison on /design/guildbot.
 */
export type MiniShape = 'cursor' | 'blob' | 'drop' | 'hex'
export type MiniFace = 'curious' | 'happy' | 'smug' | 'bored' | 'shocked' | 'sleepy' | 'sulky' | 'proud' | 'sad'
export type MiniBlush = 'proud' | 'dramatic' | 'genie' | 'meeting' | null
export type MiniMotion = 'idle' | 'hop' | 'dance' | 'walk' | 'still'

export const BOX = '-125 -125 250 250'

/** A closed path through the points, each corner rounded by its radius. */
export function rounded(pts: Point[], radii: number[]): string {
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

/** A superellipse: a squircle, softer than a circle's flat sides, rounder than a rounded square. */
function squircle(a: number, b: number, n: number, dy = 0): string {
  const pts: string[] = []
  for (let i = 0; i < 72; i++) {
    const t = (i / 72) * Math.PI * 2
    const c = Math.cos(t), s = Math.sin(t)
    const x = a * Math.sign(c) * Math.abs(c) ** (2 / n)
    const y = b * Math.sign(s) * Math.abs(s) ** (2 / n) + dy
    pts.push(`${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)}`)
  }
  return pts.join('') + 'Z'
}

const hexPoints: Point[] = Array.from({ length: 6 }, (_, i) => {
  const t = (Math.PI / 3) * i - Math.PI / 2
  return [Math.cos(t) * 104, Math.sin(t) * 100 + 4]
})

/** Each shape, and where its face sits. Kers is the round blob; the rest are for comparison. */
const SHAPES: Record<MiniShape, { d: string; face: Point }> = {
  cursor: { d: rounded([[-57, -94], [-57, 81], [-13, 42], [72, 42]], [28, 37, 17, 31]), face: [-18, 8] },
  blob: { d: squircle(100, 96, 2.6, 4), face: [0, 2] },
  drop: { d: 'M-8 -98Q0 -108 8 -98C46 -58 94 -16 94 30C94 78 52 102 0 102C-52 102 -94 78 -94 30C-94 -16 -46 -58 -8 -98Z', face: [0, 22] },
  hex: { d: rounded(hexPoints, [28, 28, 28, 28, 28, 28]), face: [0, 6] },
}

/** One eye, relative to the face centre: an oval (or an arc), with an optional slanted lid. */
type Eye = { x: number; y: number; w: number; h: number; rot: number; arc?: 'up' | 'down'; /** Lid: how far down (0..1), and its tilt. */ lid?: [number, number] }

const FACES: Record<MiniFace, [Eye, Eye]> = {
  curious: [{ x: -21, y: 14, w: 25, h: 31, rot: 0 }, { x: 22, y: 10, w: 21, h: 26, rot: 0 }],
  happy: [{ x: -21, y: 12, w: 26, h: 14, rot: 0, arc: 'up' }, { x: 21, y: 12, w: 26, h: 14, rot: 0, arc: 'up' }],
  smug: [{ x: -16, y: 13, w: 24, h: 29, rot: 0, lid: [0.2, 0] }, { x: 26, y: 13, w: 24, h: 29, rot: 0, lid: [0.42, -6] }],
  bored: [{ x: -21, y: 17, w: 25, h: 13, rot: 0 }, { x: 21, y: 17, w: 25, h: 13, rot: 0 }],
  shocked: [{ x: -24, y: 8, w: 28, h: 38, rot: 0 }, { x: 24, y: 8, w: 28, h: 38, rot: 0 }],
  sleepy: [{ x: -21, y: 16, w: 26, h: 12, rot: 0, arc: 'down' }, { x: 21, y: 16, w: 26, h: 12, rot: 0, arc: 'down' }],
  sulky: [{ x: -21, y: 14, w: 25, h: 28, rot: 0, lid: [0.42, 22] }, { x: 21, y: 14, w: 25, h: 28, rot: 0, lid: [0.42, -22] }],
  proud: [{ x: -21, y: 11, w: 28, h: 16, rot: -4, arc: 'up' }, { x: 21, y: 11, w: 28, h: 16, rot: 4, arc: 'up' }],
  sad: [{ x: -21, y: 15, w: 24, h: 28, rot: 0, lid: [0.36, -20] }, { x: 21, y: 15, w: 24, h: 28, rot: 0, lid: [0.36, 20] }],
}

/** Blush only for strong moods; its colour is the mood. */
const BLUSH: Record<Exclude<MiniBlush, null>, string> = {
  proud: '#FF9F5A',
  dramatic: '#FF5A5A',
  genie: '#B58CFF',
  meeting: '#B04A8A',
}

/** His mint, light at the top left to deep at the bottom right. */
export const MINT = '#3FCB98'
const BACK = '#0E1412'
/** His eyes are big: that's where all his expression lives. */
const EYE_SCALE = 1.5

/** Four gradient stops from one colour (light, mid, base, deep), like the reference. */
function stops(base: string): string[] {
  return [mix(base, '#FFFFFF', 0.72), mix(base, '#FFFFFF', 0.3), base, mix(base, '#0A2A20', 0.5)]
}

/** Where his face sits in the 250 box, for gear and marks. */
export function faceAt(shape: MiniShape = 'blob'): Point {
  return SHAPES[shape].face
}

/** Him, as SVG content in a -125..125 box. */
export function BlobFigure({
  shape = 'blob',
  face = 'curious',
  blush = null,
  tint,
  look = { x: 0, y: 0 },
  shadow = true,
}: {
  shape?: MiniShape
  face?: MiniFace
  blush?: MiniBlush
  /** Any body colour (the focus crowd); mint by default. */
  tint?: string
  look?: { x: number; y: number }
  shadow?: boolean
}) {
  const id = useId().replace(/:/g, '')
  const blink = useBlinks()
  const spec = SHAPES[shape]
  const [fx, fy] = spec.face
  const lx = look.x * 4
  const ly = look.y * 4
  const eyes = FACES[face]
  const g = stops(tint ?? MINT)

  return (
    <g>
      <defs>
        <mask id={`${id}-m`} maskUnits="userSpaceOnUse" x={-160} y={-160} width={320} height={320}>
          <path d={spec.d} fill="#fff" />
          <g transform={`translate(${fx + lx} ${fy + ly}) scale(${EYE_SCALE})`}>
            {eyes.map((e, i) => <EyeCut key={i} eye={e} blink={blink} />)}
          </g>
        </mask>
        <radialGradient id={`${id}-g`} gradientUnits="userSpaceOnUse" cx={-50} cy={-63} r={245}>
          {g.map((c, i) => <stop key={i} offset={`${[0, 32, 72, 100][i]}%`} stopColor={c} />)}
        </radialGradient>
        <filter id={`${id}-b`} x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="9" /></filter>
        <clipPath id={`${id}-c`}><path d={spec.d} /></clipPath>
      </defs>

      {shadow && <ellipse cx={0} cy={112} rx={72} ry={9} fill="#000" opacity={0.18} filter={`url(#${id}-b)`} />}
      {/* The near-black layer the eyes show through, then the body with the eyes cut out. */}
      <path d={spec.d} fill={BACK} />
      <g mask={`url(#${id}-m)`}>
        <rect x={-160} y={-160} width={320} height={320} fill={`url(#${id}-g)`} />
      </g>
      {/* A shine in each open eye. */}
      {!blink && (
        <g transform={`translate(${fx + lx} ${fy + ly}) scale(${EYE_SCALE})`} fill="#FFFFFF">
          {eyes.filter(e => !e.arc).map((e, i) => (
            <g key={i} transform={`translate(${e.x} ${e.y}) rotate(${e.rot})`}>
              <circle cx={e.w * 0.16} cy={e.lid ? e.h * 0.05 : -e.h * 0.2} r={Math.min(e.w, e.h) * 0.16} />
              <circle cx={-e.w * 0.14} cy={e.h * 0.18} r={Math.min(e.w, e.h) * 0.07} opacity={0.8} />
            </g>
          ))}
        </g>
      )}
      {blush && (
        <g clipPath={`url(#${id}-c)`} filter={`url(#${id}-b)`} opacity={0.75}>
          <ellipse cx={fx - 40} cy={fy + 40} rx={18} ry={10} fill={BLUSH[blush]} />
          <ellipse cx={fx + 40} cy={fy + 38} rx={18} ry={10} fill={BLUSH[blush]} />
        </g>
      )}
    </g>
  )
}

/** The bare figure, sized in px (the shape comparison). */
export function MiniKers({
  shape = 'blob',
  face = 'curious',
  blush = null,
  size = 120,
  motion = 'idle',
  follow = false,
  className,
}: {
  shape?: MiniShape
  face?: MiniFace
  blush?: MiniBlush
  /** Height in px. */
  size?: number
  motion?: MiniMotion
  follow?: boolean
  className?: string
}) {
  const look = useLookAt(follow)
  return (
    <span className={cn('gb-kers relative inline-block shrink-0', className)} style={{ width: size, height: size }} data-motion={motion}>
      <span className="gb-kers-body absolute inset-0">
        <svg viewBox={BOX} className="absolute inset-0 w-full h-full overflow-visible" aria-hidden>
          <BlobFigure shape={shape} face={face} blush={blush} look={look} />
        </svg>
      </span>
    </span>
  )
}

/** One eye, cut out of the body (black in the mask). Blinks squash it, unless it's an arc. */
function EyeCut({ eye, blink }: { eye: Eye; blink: boolean }) {
  const clip = useId().replace(/:/g, '')
  const { x, y, w, h, rot, arc } = eye
  if (arc) {
    const d = arc === 'up' ? `M${-w / 2} ${h / 3}Q0 ${-h} ${w / 2} ${h / 3}` : `M${-w / 2} ${-h / 3}Q0 ${h} ${w / 2} ${-h / 3}`
    return <path d={d} transform={`translate(${x} ${y}) rotate(${rot})`} stroke="#000" strokeWidth={7} strokeLinecap="round" fill="none" />
  }
  return (
    <g transform={`translate(${x} ${y}) rotate(${rot}) scale(1 ${blink ? 0.12 : 1})`}>
      <ellipse rx={w / 2} ry={h / 2} fill="#000" />
      {/* A lid: body (white in the mask) covering the top of the eye at a slant, kept inside the eye. */}
      {eye.lid && (
        <>
          <clipPath id={clip}><ellipse rx={w / 2 + 0.5} ry={h / 2 + 0.5} /></clipPath>
          <rect x={-w} y={-h / 2 - h} width={w * 2} height={h + h * eye.lid[0]} fill="#fff" clipPath={`url(#${clip})`} transform={`rotate(${eye.lid[1]} 0 ${-h / 2 + h * eye.lid[0]})`} />
        </>
      )}
    </g>
  )
}

/** Now and then, a blink (never under reduced motion). */
function useBlinks(): boolean {
  const [shut, setShut] = useState(false)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let t: ReturnType<typeof setTimeout>
    const next = () => {
      t = setTimeout(() => {
        setShut(true)
        t = setTimeout(() => { setShut(false); next() }, 120)
      }, 2600 + Math.random() * 3400)
    }
    next()
    return () => clearTimeout(t)
  }, [])
  return shut
}
