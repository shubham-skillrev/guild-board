'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils/cn'

/**
 * GuildBot's house, where he sleeps: the night scene (22:00 to 07:00) of
 * GuildBotScene. Drawn as a small house in a 3/4
 * view (a front wall and a shaded side wall, a terracotta roof, a chimney),
 * outlined in the same dark line as the character. No tile behind it: it
 * stands on its own shadow. Looks:
 *
 *   night  the torch burns, the windows glow, a moon over the chimney, and
 *          z's drift out: he's asleep inside
 *   dark   no asks left: grey house, no lights, until the oldest ask ages out
 *   day    plain, torch unlit (kept for previews)
 *
 * The sign by the door is asks left this week (guests have none). The door
 * swings in on a knock (data-door="open") and whatever is passed as
 * `doorway` stands in it: GuildBot, peeking. Animations live in globals.css.
 */
export type HomeLook = 'day' | 'night' | 'dark'

const PALETTE = {
  day: { front: '#F6EAD7', gable: '#FBF3E6', side: '#DCC3A1', roof: '#D0603F', roofSide: '#A9472D', door: '#2F7A74', trim: '#2A2420' },
  night: { front: '#D9CAB4', gable: '#E2D5C1', side: '#AE977A', roof: '#A84B33', roofSide: '#833723', door: '#24605B', trim: '#1E1A17' },
  dark: { front: '#6A6D76', gable: '#73767F', side: '#52555D', roof: '#4A4D55', roofSide: '#3B3E45', door: '#33363D', trim: '#1F2126' },
} as const

export function GuildBotHome({
  look,
  left,
  door = 'closed',
  knocking = false,
  flicker = false,
  doorway,
  width = 84,
  genie = false,
}: {
  look: HomeLook
  left: number | null
  door?: 'open' | 'closed'
  knocking?: boolean
  flicker?: boolean
  /** Shown standing in the doorway (visible when the door is open). */
  doorway?: ReactNode
  width?: number
  /** Last three asks: the plate goes genie blue. */
  genie?: boolean
}) {
  return (
    <span
      className="gb-home relative inline-block"
      style={{ width, height: (width * 88) / 96 }}
      data-knock={knocking ? '' : undefined}
      data-door={door}
      data-flicker={flicker ? '' : undefined}
      data-look={look}
    >
      <House look={look} doorway={doorway} />
      {left !== null && (
        <span
          aria-hidden
          className={cn(
            'absolute right-0 bottom-[6%] min-w-6 h-5.5 px-1.5 inline-flex items-center justify-center rounded-md border-2 text-[12px] font-bold tabular-nums leading-none shadow-md',
            genie
              ? 'bg-indigo-jp border-[#1E2B57] text-white'
              : look === 'dark'
                ? 'bg-[#33363D] border-[#1F2126] text-white/55'
                : 'bg-[#8B5A3C] border-[#2A2420] text-[#FBF3E6]',
          )}
        >
          {left}
        </span>
      )}
    </span>
  )
}

function House({ look, doorway }: { look: HomeLook; doorway?: ReactNode }) {
  const c = PALETTE[look]
  const lit = look === 'night'
  const line = { stroke: c.trim, strokeWidth: 1.8, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  return (
    <svg viewBox="0 0 96 88" className="gb-house absolute inset-0 w-full h-full overflow-visible" aria-hidden>
      <defs>
        <radialGradient id="gb-torch-glow">
          <stop offset="0%" stopColor="#F7B15A" stopOpacity={0.7} />
          <stop offset="100%" stopColor="#F7B15A" stopOpacity={0} />
        </radialGradient>
        <radialGradient id="gb-window-glow">
          <stop offset="0%" stopColor="#FFD47A" stopOpacity={0.55} />
          <stop offset="100%" stopColor="#FFD47A" stopOpacity={0} />
        </radialGradient>
      </defs>

      {/* Its shadow on the ground. */}
      <ellipse cx={48} cy={83} rx={40} ry={4.5} fill="#000" opacity={0.16} />

      {lit && <path d="M86 8a6 6 0 1 1-6.4 9.4 5 5 0 0 0 6.4-9.4Z" fill="#F4E7B8" opacity={0.9} />}

      {/* Chimney, behind the roof. */}
      <path d="M64 12h8v14l-8 3Z" fill={c.side} {...line} />
      <path d="M63 10.5h10v3H63Z" fill={c.roofSide} {...line} />

      {/* Side wall, in shade, with its window. */}
      <path d="M58 46 82 36v34L58 80Z" fill={c.side} {...line} />
      {lit && <circle cx={70} cy={51} r={13} fill="url(#gb-window-glow)" />}
      <path d="M64.5 46.5 75.5 42v10l-11 4.5Z" fill={look === 'dark' ? '#2B2D33' : '#3A3F4F'} {...line} strokeWidth={1.5} />
      <path data-part="window" d="M64.5 46.5 75.5 42v10l-11 4.5Z" fill="#FFD47A" opacity={lit ? 0.95 : 0} />
      <path d="M70 44.3v10" stroke={c.trim} strokeWidth={1.2} />
      {/* Asleep inside. */}
      <g className="gb-zzz gb-house-zzz" fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path data-z d="M80 34h4l-4 4h4" strokeWidth={1.5} />
        <path data-z d="M86 25h5l-5 5h5" strokeWidth={1.7} />
      </g>

      {/* Roof: the long plane over the side, then the front gable. */}
      <path d="M34 20 58 10l24 26-24 10Z" fill={c.roofSide} {...line} />
      <path d="M40 18.5 62 9.4M46 29l22-9.4M52 39 74 29.8" stroke={c.trim} strokeOpacity={0.25} strokeWidth={1.2} />

      {/* Front wall, gable included. */}
      <path d="M12 44.5V80h46V44.5L35 22Z" fill={c.front} {...line} />
      <path d="M8 47 34 20l26 27" fill="none" stroke={c.roof} strokeWidth={5} strokeLinejoin="round" strokeLinecap="round" />
      <path d="M8 47 34 20l26 27" fill="none" {...line} strokeWidth={1.2} />

      {/* Antenna on the apex: the ◈. */}
      <path d="M34 20v-7" stroke={c.trim} strokeWidth={1.8} strokeLinecap="round" />
      <path
        d="M34 6.5 37.2 9.7 34 12.9 30.8 9.7Z"
        className={look === 'dark' ? undefined : 'fill-saffron'}
        fill={look === 'dark' ? '#6A6D76' : undefined}
        stroke={c.trim}
        strokeWidth={1}
        strokeLinejoin="round"
      />

      {/* Torch beside the door. */}
      {lit && <circle data-part="glow" cx={19} cy={53} r={9} fill="url(#gb-torch-glow)" />}
      <path d="M19 60.5v7" stroke={c.trim} strokeWidth={1.8} strokeLinecap="round" />
      <rect x={17} y={57.2} width={4} height={3.6} rx={1.2} fill="#7A4A2E" stroke={c.trim} strokeWidth={1.2} />
      {lit && <path data-part="flame" d="M19 49.6c2 2.2 2.6 3.6 2.6 4.8a2.6 2.6 0 0 1-5.2 0c0-1.2.6-2.6 2.6-4.8Z" fill="#F7A440" stroke="#C4621E" strokeWidth={0.8} />}

      {/* Round window in the gable. */}
      <circle cx={35} cy={37} r={4.6} fill={lit ? '#FFD47A' : look === 'dark' ? '#2B2D33' : '#3A3F4F'} {...line} strokeWidth={1.5} />
      <path d="M35 32.4v9.2M30.4 37h9.2" stroke={c.trim} strokeWidth={1} />

      {/* Doorway: dark inside, GuildBot waits there. */}
      <path d="M27 80V62a8 8 0 0 1 16 0v18Z" fill="#141824" />
      {doorway && (
        <foreignObject x={22} y={50} width={26} height={30}>
          <div data-part="doorway" className="w-full h-full flex items-end justify-center">{doorway}</div>
        </foreignObject>
      )}
      <g data-part="door">
        <path d="M27 80V62a8 8 0 0 1 16 0v18Z" fill={c.door} {...line} />
        <path d="M31 66v10M35 64.5v11.5M39 66v10" stroke={c.trim} strokeOpacity={0.3} strokeWidth={1.1} />
        <circle cx={39.6} cy={71.5} r={1.3} fill="#E8B64B" stroke={c.trim} strokeWidth={0.8} />
      </g>
      {/* Step. */}
      <path d="M24 80h22" stroke={c.trim} strokeWidth={2.4} strokeLinecap="round" />
    </svg>
  )
}
