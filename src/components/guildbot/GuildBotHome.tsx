'use client'

import { useEffect, useState } from 'react'
import type { Mood } from '@guildboard/guildbot'
import { cn } from '@/lib/utils/cn'

/**
 * Where GuildBot lives: the chat button, drawn as a little house in the same
 * line language as its face (one stroke weight, round caps, the saffron ◈
 * on the roof). Four looks:
 *
 *   day    paper tile, plain house, torch unlit
 *   night  night sky from 19:00 to 06:00 local; the torch burns, the window glows
 *   genie  the last three asks of the week: the house becomes a magic lamp, in blue
 *   dark   no asks left: lights out until the oldest ask ages out
 *
 * The number on the plate is asks left this week; guests have no plate.
 * The knock (rocking house, door swinging in, eyes peeking by mood) and the
 * flicker are driven by data attributes, animated in globals.css.
 */
export type HomeLook = 'day' | 'night' | 'genie' | 'dark'

/** Which look, from the asks left (null for guests) and the local hour. */
export function homeLook(left: number | null, night: boolean): HomeLook {
  if (left === 0) return 'dark'
  if (left !== null && left <= 3) return 'genie'
  return night ? 'night' : 'day'
}

/** True from 19:00 to 06:00 in the viewer's own time zone; rechecked every few minutes. */
export function useIsNight(): boolean {
  const [night, setNight] = useState(false)
  useEffect(() => {
    const check = () => {
      const h = new Date().getHours()
      setNight(h >= 19 || h < 6)
    }
    check()
    const id = setInterval(check, 5 * 60_000)
    return () => clearInterval(id)
  }, [])
  return night
}

export function GuildBotHome({
  look,
  mood,
  left,
  door = 'closed',
  knocking = false,
  flicker = false,
}: {
  look: HomeLook
  mood: Mood
  left: number | null
  door?: 'open' | 'closed'
  knocking?: boolean
  flicker?: boolean
}) {
  const lit = look === 'night'
  return (
    <span
      className={cn(
        'gb-home relative inline-flex items-center justify-center w-16 h-16 rounded-[18px] border shadow-lg bg-(--gb-tile) transition-[background-color,border-color,color] duration-300 motion-reduce:transition-none',
        look === 'day' && '[--gb-tile:var(--color-paper)] border-border-strong text-ink',
        look === 'night' && '[--gb-tile:var(--gb-night)] border-white/10 text-(--gb-night-line)',
        look === 'genie' && '[--gb-tile:var(--gb-night)] border-white/10 text-(--gb-genie)',
        look === 'dark' && '[--gb-tile:#0D0E11] border-white/5 text-(--gb-night-line)/35',
      )}
      data-knock={knocking ? '' : undefined}
      data-door={door}
      data-flicker={flicker ? '' : undefined}
    >
      {look === 'genie' ? <Lamp /> : <House mood={mood} lit={lit} dark={look === 'dark'} />}
      {left !== null && (
        <span
          aria-hidden
          className={cn(
            'absolute -right-1.5 -bottom-1.5 min-w-5 h-5 px-1 inline-flex items-center justify-center rounded-md border text-[11px] font-semibold tabular-nums leading-none shadow-sm',
            look === 'genie'
              ? 'bg-indigo-jp border-indigo-jp text-white'
              : look === 'dark'
                ? 'bg-[#0D0E11] border-white/15 text-white/50'
                : 'bg-paper border-border-strong text-ink',
          )}
        >
          {left}
        </span>
      )}
    </span>
  )
}

const line = { stroke: 'currentColor', strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, fill: 'none' }

function House({ mood, lit, dark }: { mood: Mood; lit: boolean; dark: boolean }) {
  return (
    <svg width={48} height={48} viewBox="0 0 48 48" aria-hidden className="gb-house overflow-visible">
      {/* Antenna on the roof: the ◈, saffron like the face's, grey when the lights are out. */}
      <path d="M24 1.9 26.6 4.5 24 7.1 21.4 4.5Z" className={dark ? 'fill-current' : 'fill-saffron'} />
      <path d="M24 7.1v2.6" {...line} strokeWidth={1.7} />
      {/* Roof with eaves, and the walls under it (open at the top: a gable). */}
      <path d="M6 21 24 9.7 42 21" {...line} strokeWidth={1.9} />
      <path d="M10 19.6V41.5a2.5 2.5 0 0 0 2.5 2.5h23a2.5 2.5 0 0 0 2.5-2.5V19.6" {...line} strokeWidth={1.8} />
      <path d="M4.5 44H10M38 44h5.5" {...line} strokeWidth={1.4} opacity={0.5} />

      {/* Window, upper right: glows at night, sputters when knocked in the dark. */}
      <rect x={30.5} y={23} width={5} height={5} rx={1.2} {...line} strokeWidth={1.4} />
      <rect data-part="window" x={31.2} y={23.7} width={3.6} height={3.6} rx={0.8} fill="var(--gb-window)" opacity={lit ? 0.9 : 0} />

      {/* Torch on the wall, left of the door. */}
      {lit && <circle data-part="glow" cx={14.2} cy={26.6} r={6} fill="url(#gb-torch-glow)" />}
      {/* The torch: a stick with a wrapped head, the flame sits on top. */}
      <path d="M14.2 31.4v4.8" {...line} strokeWidth={1.4} />
      <rect x={12.9} y={28.9} width={2.6} height={2.6} rx={0.8} {...line} strokeWidth={1.3} />
      {lit && (
        <path
          data-part="flame"
          d="M14.2 23.4c1.4 1.6 1.8 2.6 1.8 3.4a1.8 1.8 0 0 1-3.6 0c0-.8.4-1.8 1.8-3.4Z"
          fill="var(--gb-flame)"
        />
      )}
      <defs>
        <radialGradient id="gb-torch-glow">
          <stop offset="0%" stopColor="var(--gb-flame)" stopOpacity={0.55} />
          <stop offset="100%" stopColor="var(--gb-flame)" stopOpacity={0} />
        </radialGradient>
      </defs>

      {/* Doorway: GuildBot waits inside, and peeks when you knock. */}
      <path d="M19.5 44V33.5a4.5 4.5 0 0 1 9 0V44Z" fill="#0B0C10" opacity={0.9} />
      <g data-part="eyes" className="text-[#E9E4DA]">
        <Eyes mood={mood} />
      </g>
      <g data-part="door">
        {/* Filled with the tile's colour, so the eyes stay hidden until it swings in. */}
        <path d="M19.5 44V33.5a4.5 4.5 0 0 1 9 0V44Z" fill="var(--gb-tile)" stroke="currentColor" strokeLinejoin="round" strokeWidth={1.7} />
        <circle cx={26.3} cy={38.6} r={0.85} fill="currentColor" />
      </g>
    </svg>
  )
}

/** The face's eyes, shrunk to fit the doorway (see GuildBotMark for the full face). */
function Eyes({ mood }: { mood: Mood }) {
  const eye = { ...line, strokeWidth: 1.2 }
  switch (mood) {
    case 'bored':
      return <path d="M21.6 36.2h1.8M24.6 36.2h1.8" {...eye} />
    case 'dramatic':
      return (
        <>
          <circle cx={22.5} cy={36} r={1.05} {...eye} />
          <circle cx={25.5} cy={36} r={1.05} {...eye} />
        </>
      )
    case 'proud':
      return <path d="M21.5 36.6q1-1.3 2 0M24.5 36.6q1-1.3 2 0" {...eye} />
    default:
      return (
        <>
          <circle cx={22.5} cy={36} r={0.75} fill="currentColor" />
          <path d="M24.6 36.1h1.8" {...eye} />
        </>
      )
  }
}

/** Genie mode: an oil lamp with the ◈ on its lid, smoke curling from the spout. */
function Lamp() {
  return (
    <svg width={48} height={48} viewBox="0 0 48 48" aria-hidden className="gb-house overflow-visible">
      <g transform="translate(-2 0)">
        {/* Smoke from the spout. */}
        <path data-part="smoke" d="M42.6 25.2c-1.6-1.6 1.4-3 0-4.8" {...line} strokeWidth={1.3} />
        <path data-part="smoke" d="M44.6 24.6c-1.4-1.8 1.6-3.2 0-5" {...line} strokeWidth={1.3} />
        {/* Lid and knob. */}
        <path d="M18 32.5c0-3.6 12-3.6 12 0" {...line} strokeWidth={1.7} />
        <path d="M24 23.7 26 25.7 24 27.7 22 25.7Z" fill="currentColor" />
        <path d="M24 27.7v1.2" {...line} strokeWidth={1.5} />
        {/* Body, spout and handle. */}
        <path d="M12.5 32.5h22c4 0 6.5-2.4 9-5.5-1.6 4.8-4.6 9.3-10.5 10.3-2.4 2.3-5.6 3.2-9 3.2s-6.6-.9-9-3.2c-1.6-1.4-2.5-3-2.5-4.8Z" {...line} strokeWidth={1.8} />
        <path d="M12.6 34.4c-4.4.4-5.6-4.6-2-5.2 1.3-.2 2 .6 2.2 1.6" {...line} strokeWidth={1.6} />
        {/* Foot. */}
        <path d="M19 41.2c0 1.6 2.3 2.4 5 2.4s5-.8 5-2.4" {...line} strokeWidth={1.6} />
        <path d="M17.5 44h13" {...line} strokeWidth={1.6} />
      </g>
    </svg>
  )
}
