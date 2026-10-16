'use client'

import { useEffect, useRef, useState } from 'react'
import type { Expression } from '@guildboard/guildbot'
import { cn } from '@/lib/utils/cn'

/**
 * GuildBot himself, in the board's colours: a soft squircle head in the
 * theme's paper tones outlined in ink, the saffron ◈ on his antenna, a dark
 * visor whose glowing saffron eyes carry the face, and two small feet. In the
 * last three asks of the week his eyes go genie blue. Colours come from the
 * theme (.gb-bot in globals.css), so he works on light and dark.
 *
 * What he's doing shows on him, never as a ring round him:
 *
 *   listening  the antenna pulses (you are typing to him)
 *   searching  his eyes scan side to side (reading the board)
 *   thinking   thought dots rise above his head
 *   writing    typing dots beside him
 *   talking    sound lines off the side of his head
 *
 * BotHead is the head on its own, as SVG, for the scenes (GuildBotDesk) to
 * place: 64 × 58 user units, antenna tip at the top.
 */
export type AvatarStatus = 'idle' | 'listening' | 'searching' | 'thinking' | 'writing' | 'talking'

export function GuildBotAvatar({
  expression = 'smug',
  status,
  size = 64,
  genie = false,
  feet = true,
  walking = false,
  follow = false,
  className,
}: {
  expression?: Expression
  status?: AvatarStatus | null
  /** Height in px. */
  size?: number
  genie?: boolean
  feet?: boolean
  walking?: boolean
  /** Eyes drift towards the pointer (fine pointers only, never under reduced motion). */
  follow?: boolean
  className?: string
}) {
  const look = useLookAt(follow)
  const box = feet ? { w: 64, h: 72, y: 0 } : { w: 64, h: 58, y: 0 }
  return (
    <span
      className={cn('gb-bot relative inline-block shrink-0', className)}
      data-walking={walking ? '' : undefined}
      style={{ width: (size * box.w) / box.h, height: size }}
    >
      <svg viewBox={`0 ${box.y} ${box.w} ${box.h}`} width="100%" height="100%" aria-hidden className="overflow-visible">
        {feet && (
          <g>
            <ellipse cx={32} cy={69} rx={17} ry={2.4} fill="#000" opacity={0.14} />
            <rect data-foot="l" x={19} y={57} width={10} height={9} rx={4.5} className="gb-foot" />
            <rect data-foot="r" x={35} y={57} width={10} height={9} rx={4.5} className="gb-foot" />
          </g>
        )}
        <g className="gb-body">
          <BotHead expression={expression} genie={genie} status={status ?? null} look={look} />
        </g>
      </svg>
    </span>
  )
}

/** The head, antenna and face, with whatever status shows on it. 64 × 58 units. */
export function BotHead({
  expression,
  genie = false,
  status = null,
  look = { x: 0, y: 0 },
}: {
  expression: Expression
  genie?: boolean
  status?: AvatarStatus | null
  look?: { x: number; y: number }
}) {
  return (
    <g className="gb-bot-head" data-status={status ?? undefined} style={{ ['--gb-eye' as string]: genie ? '#8EC2FF' : '#F7A851' }}>
      {/* Antenna: the board's ◈. Pulses while he's listening. */}
      <path d="M32 6.5v6" className="gb-line" strokeWidth={2} strokeLinecap="round" />
      <path data-part="antenna" d="M32 1 35.5 4.5 32 8 28.5 4.5Z" className="gb-antenna" strokeWidth={1} strokeLinejoin="round" style={genie ? { fill: '#5B8DEF' } : undefined} />

      {/* Head: a squircle lit from the top left. */}
      <rect x={6} y={12} width={52} height={45} rx={19} className="gb-shell" strokeWidth={2} />
      <ellipse cx={21} cy={19} rx={9} ry={3.2} fill="#fff" opacity={0.6} transform="rotate(-14 21 19)" />

      {/* Cheeks, in saffron. */}
      <ellipse cx={13.5} cy={45} rx={3.6} ry={2.1} className="gb-cheek" />
      <ellipse cx={50.5} cy={45} rx={3.6} ry={2.1} className="gb-cheek" />

      {/* Visor, with a glint. */}
      <rect x={12.5} y={24} width={39} height={25} rx={12.5} fill="#121318" />
      <path d="M18 28.5q3-2.6 8-2.6" stroke="#fff" strokeOpacity={0.2} strokeWidth={1.6} strokeLinecap="round" fill="none" />

      <g style={{ transform: `translate(${look.x}px, ${look.y}px)`, transition: 'transform 180ms var(--ease-out)' }}>
        <g data-part="eyes" filter="url(#gb-eye-glow)">
          <Face expression={expression} />
        </g>
      </g>
      <defs>
        <filter id="gb-eye-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="0.9" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* Status, on him. */}
      {status === 'thinking' && (
        <g className="gb-status">
          <circle data-dot cx={56} cy={10} r={2.2} />
          <circle data-dot cx={62} cy={3} r={3} />
          <circle data-dot cx={70} cy={-5} r={3.8} />
        </g>
      )}
      {status === 'writing' && (
        <g className="gb-status">
          <circle data-dot cx={-14} cy={40} r={2.2} />
          <circle data-dot cx={-7.5} cy={40} r={2.2} />
          <circle data-dot cx={-1} cy={40} r={2.2} />
        </g>
      )}
      {status === 'talking' && (
        <g className="gb-status" fill="none" strokeLinecap="round">
          <path data-wave d="M2 30q-3 6 0 12" strokeWidth={2} />
          <path data-wave d="M-3 26q-5 10 0 20" strokeWidth={2} />
        </g>
      )}
    </g>
  )
}

/** The eyes (and a mouth line) on the visor, per expression. Glow colour is --gb-eye. */
function Face({ expression }: { expression: Expression }) {
  const fill = 'var(--gb-eye)'
  const s = { stroke: 'var(--gb-eye)', strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' }
  const pill = (x: number, h = 9, y = 36.5 - h / 2) => <rect data-eye x={x - 3} y={y} width={6} height={h} rx={3} fill={fill} />
  switch (expression) {
    case 'smug':
      return (
        <>
          {pill(25)}
          <path d="M36 36.5h6.5" {...s} />
          <path d="M35.5 30.5l7-1.6" {...s} strokeWidth={1.6} />
          <path d="M28 44.2q4 1.6 8.5-1.2" {...s} strokeWidth={1.6} />
        </>
      )
    case 'bored':
      return (
        <>
          <path d="M21.5 37.5h7M35.5 37.5h7" {...s} />
          <path d="M21.5 34.2h7M35.5 34.2h7" {...s} strokeWidth={1.2} opacity={0.45} />
          <path d="M28.5 44h7" {...s} strokeWidth={1.6} />
        </>
      )
    case 'dramatic':
      return (
        <>
          <circle cx={25} cy={36.5} r={5} fill={fill} />
          <circle cx={39} cy={36.5} r={5} fill={fill} />
          <circle cx={26.6} cy={34.6} r={1.5} fill="#121318" />
          <circle cx={40.6} cy={34.6} r={1.5} fill="#121318" />
          <path d="M20.5 31.4l7-2M43.5 31.4l-7-2" {...s} strokeWidth={1.6} />
          <ellipse cx={32} cy={45} rx={2} ry={1.6} fill={fill} />
        </>
      )
    case 'proud':
      return (
        <>
          <path d="M21.5 38q3.5-5 7 0M35.5 38q3.5-5 7 0" {...s} />
          <path d="M26.5 42.6q5.5 4 11 0" {...s} strokeWidth={1.8} />
        </>
      )
    case 'relieved':
      return (
        <>
          <path d="M21.5 35.5q3.5 3.6 7 0M35.5 35.5q3.5 3.6 7 0" {...s} />
          <path d="M28.5 43.6q3.5 2 7 0" {...s} strokeWidth={1.6} />
          <path d="M47 27.5c1.2 1.6 1.6 2.4 1.6 3.1a1.6 1.6 0 0 1-3.2 0c0-.7.4-1.5 1.6-3.1Z" fill="#8EC2FF" />
        </>
      )
    case 'excited':
      return (
        <>
          <path d="M25 31l1.4 4.1 4.1 1.4-4.1 1.4-1.4 4.1-1.4-4.1-4.1-1.4 4.1-1.4Z" fill={fill} />
          <path d="M39 31l1.4 4.1 4.1 1.4-4.1 1.4-1.4 4.1-1.4-4.1-4.1-1.4 4.1-1.4Z" fill={fill} />
          <path d="M27.5 43q4.5 4.2 9 0Z" fill={fill} />
        </>
      )
    case 'nosy':
      return (
        <>
          <rect data-eye x={19.5} y={33} width={6} height={7} rx={3} fill={fill} />
          <path d="M33 36.5h6.5" {...s} />
          <path d="M33 31.5l6.5 1" {...s} strokeWidth={1.6} />
          <circle cx={36} cy={44} r={1.5} fill={fill} />
        </>
      )
    case 'lonely':
      return (
        <>
          {pill(25, 6, 36)}
          {pill(39, 6, 36)}
          <path d="M21.5 32.5l6-1.4M42.5 32.5l-6-1.4" {...s} strokeWidth={1.4} />
          <path d="M29 45.2q3-1.8 6 0" {...s} strokeWidth={1.6} />
        </>
      )
    case 'sleepy':
      return (
        <>
          <path d="M21.5 38q3.5 2 7 0M35.5 38q3.5 2 7 0" {...s} />
          <path d="M30 44.5h4" {...s} strokeWidth={1.4} />
        </>
      )
    default:
      return null
  }
}

/** A small offset towards the pointer, for the eyes; zero when off or reduced motion. */
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
        setLook({ x: Math.max(-2.5, Math.min(2.5, dx * 5)), y: Math.max(-1.6, Math.min(1.6, dy * 4)) })
      })
    }
    window.addEventListener('pointermove', move, { passive: true })
    return () => { window.removeEventListener('pointermove', move); cancelAnimationFrame(frame.current) }
  }, [on])
  return on ? look : { x: 0, y: 0 }
}
