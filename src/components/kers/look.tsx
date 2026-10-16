'use client'

import { useEffect, useId, useRef, useState } from 'react'
import type { Expression, Mood } from '@guildboard/guildbot'

/**
 * Kers's look, shared by everything that draws him: his mood colours (in
 * traditional Japanese dyes), his googly eyes, and the pointer they follow.
 */
export type KersColour = Mood | 'genie' | 'meeting'

/** His mood dyes: traditional Japanese colours. */
export const KERS_COLOURS: Record<KersColour, string> = {
  smug: '#E2943B',     // kuchiba, fallen-leaf orange (the app's saffron)
  bored: '#949495',    // nezumi-iro, "mouse colour"
  dramatic: '#B7282E', // akane, madder red
  proud: '#F8B500',    // yamabuki, golden
  genie: '#1E50A2',    // ruri, lapis
  meeting: '#6C3A5C',  // budo, grape
}

/** What he's up to while you chat or work: some of it shows on him. */
export type AvatarStatus = 'idle' | 'listening' | 'searching' | 'thinking' | 'writing' | 'talking'

/** Fill colours for the anonymous cursors in the focus crowd: Japanese dyes, none of them his. */
export const CREW_TINTS = ['#2EC4A6', '#FF7AA8', '#00B3D6', '#8FD14F', '#FF9F43', '#6C6CFF', '#3BB273', '#E06BD0']

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
  // Puppy eyes: big pupils with a big shine.
  const open: EyeShape = { r: 12, lid: [0, 0], tilt: [0, 0], pupil: { dx: 0, dy: 1, r: 6.6 } }
  switch (e) {
    // His everyday face: friendly, both eyes open, a sly sideways glance (the wit is in the brow, not a squint).
    case 'smug': return { ...open, lid: [0.05, 0.05], pupil: { dx: 2.2, dy: 0.5, r: 6.6 } }
    case 'bored': return { ...open, lid: [0.6, 0.6], pupil: { dx: 0, dy: 4, r: 5 } }
    case 'dramatic': return { ...open, r: 15.5, pupil: { dx: 0, dy: 0, r: 3.4 } }
    case 'proud': return { ...open, arcs: 'up' }
    case 'relieved': return { ...open, arcs: 'down' }
    case 'excited': return { ...open, r: 13, pupil: { dx: 0, dy: 0, r: 6.2 }, sparkle: true }
    case 'nosy': return { ...open, lid: [0.45, 0.08], pupil: { dx: -6, dy: 0, r: 5 } }
    case 'lonely': return { ...open, lid: [0.3, 0.3], tilt: [14, -14], pupil: { dx: 0, dy: 4.5, r: 5.6 } }
    case 'sleepy': return { ...open, lid: [0.9, 0.9], pupil: { dx: 0, dy: 3.5, r: 5 } }
    case 'grumpy': return { ...open, lid: [0.5, 0.5], tilt: [-24, 24], pupil: { dx: 0, dy: 1.5, r: 5.2 } }
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
      <g className="kx-pupil">
      <circle cx={cx + px} cy={cy + py} r={pupil.r} fill="#1A1A1F" style={{ transition: 'cx 160ms ease-out, cy 160ms ease-out' }} />
      <circle cx={cx + px + pupil.r * 0.32} cy={cy + py - pupil.r * 0.36} r={pupil.r * 0.4} fill="#FFFFFF" />
      {/* A second, smaller sparkle: big shiny eyes. */}
      <circle cx={cx + px - pupil.r * 0.38} cy={cy + py + pupil.r * 0.36} r={pupil.r * 0.16} fill="#FFFFFF" opacity={0.85} />
      </g>
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
