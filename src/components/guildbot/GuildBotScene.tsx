'use client'

import { useEffect, useState, type ReactNode } from 'react'
import type { Expression } from '@guildboard/guildbot'
import { cn } from '@/lib/utils/cn'
import { BotHead, type AvatarStatus } from '@/components/guildbot/GuildBotAvatar'
import { GuildBotHome } from '@/components/guildbot/GuildBotHome'

/**
 * GuildBot's corner, as a little scene that changes with the time of day
 * (the viewer's own clock):
 *
 *   coding      weekdays 09:00 to 19:00: at his desk, typing at a laptop
 *   meditating  mornings, evenings and weekends: floating over a cushion
 *   night       22:00 to 07:00: home asleep, in his house, the torch lit
 *
 * While you chat he is at the desk whatever the hour (with a desk lamp at
 * night): he got up to work for you, and what he's doing shows on him.
 *
 * The asks left this week are written on his saffron mug. In the last three
 * the mug becomes a genie's lamp and his eyes go blue; with none left the
 * laptop is shut, he's asleep on the desk, and an OUT sign stands where the
 * mug was. Colours come from the theme (.gb-scene in globals.css).
 */
export type Activity = 'coding' | 'meditating' | 'night'
export type Asks = 'normal' | 'genie' | 'out'

export function activityAt(d: Date): Activity {
  const h = d.getHours()
  if (h >= 22 || h < 7) return 'night'
  const weekday = d.getDay() >= 1 && d.getDay() <= 5
  return weekday && h >= 9 && h < 19 ? 'coding' : 'meditating'
}

/** The current activity, rechecked every few minutes. Null until mounted (no SSR guess). */
export function useActivity(): Activity | null {
  const [a, setA] = useState<Activity | null>(null)
  useEffect(() => {
    const check = () => setA(activityAt(new Date()))
    const first = setTimeout(check, 0)
    const id = setInterval(check, 5 * 60_000)
    return () => { clearTimeout(first); clearInterval(id) }
  }, [])
  return a
}

export function GuildBotScene({
  activity,
  asks,
  left,
  expression,
  status = null,
  knocking = false,
  away = false,
  doorOpen = false,
  doorway,
  lamp = false,
  width = 120,
}: {
  activity: Activity
  asks: Asks
  /** Asks left this week, for the mug; null for guests. */
  left: number | null
  expression: Expression
  status?: AvatarStatus | null
  /** You just tapped him. */
  knocking?: boolean
  /** He's out for a walk: an empty chair. */
  away?: boolean
  /** Night only: the house door. */
  doorOpen?: boolean
  doorway?: ReactNode
  /** A desk lamp, for chatting at night. */
  lamp?: boolean
  width?: number
}) {
  if (activity === 'night') {
    return (
      <GuildBotHome
        look={asks === 'out' ? 'dark' : 'night'}
        left={left}
        width={width * 0.8}
        knocking={knocking}
        door={doorOpen ? 'open' : 'closed'}
        doorway={doorway}
        genie={asks === 'genie'}
      />
    )
  }
  const genie = asks === 'genie'
  const out = asks === 'out'
  // Meditating, he wears a calm face unless something just happened.
  const face: Expression = out ? 'sleepy' : activity === 'meditating' && (expression === 'smug' || expression === 'bored') ? 'relieved' : expression
  return (
    <span
      className="gb-scene relative inline-block"
      style={{ width, height: (width * 90) / 120 }}
      data-activity={activity}
      data-knock={knocking ? '' : undefined}
      data-status={status ?? undefined}
      data-out={out ? '' : undefined}
    >
      <svg viewBox="0 0 120 90" className="absolute inset-0 w-full h-full overflow-visible" aria-hidden>
        <ellipse cx={60} cy={86.5} rx={54} ry={3.2} fill="#000" opacity={0.12} />
        {activity === 'coding' ? (
          <Desk face={face} genie={genie} out={out} away={away} status={status} lamp={lamp} />
        ) : (
          <Cushion face={face} genie={genie} away={away} status={status} />
        )}
        {genie ? <GenieLamp x={activity === 'coding' ? 96 : 92} y={activity === 'coding' ? 62 : 84} /> : out ? <OutSign y={activity === 'coding' ? 0 : 22} /> : <Mug x={activity === 'coding' ? 100 : 98} y={activity === 'coding' ? 62 : 84} />}
      </svg>
      {left !== null && !out && (
        <span
          aria-hidden
          className={cn(
            'absolute -translate-x-1/2 -translate-y-1/2 text-[11px] font-bold tabular-nums leading-none',
            genie ? 'min-w-4.5 h-4.5 px-1 inline-flex items-center justify-center rounded-full bg-indigo-jp text-white shadow-sm' : 'text-parchment',
          )}
          style={activity === 'coding' ? { left: genie ? '94%' : '88.3%', top: genie ? '75%' : '62%' } : { left: genie ? '91%' : '86.6%', top: genie ? '98%' : '86%' }}
        >
          {left}
        </span>
      )}
    </span>
  )
}

function Desk({ face, genie, out, away, status, lamp }: { face: Expression; genie: boolean; out: boolean; away: boolean; status: AvatarStatus | null; lamp: boolean }) {
  return (
    <>
      {/* Desk lamp, chatting at night. */}
      {lamp && (
        <g>
          <path d="M24 37 L44 57.5 H18 Z" className="gb-lamp-light" />
          <ellipse cx={25} cy={57} rx={5} ry={1.4} className="gb-foot" />
          <path d="M25 56.5 L21 46 L27 37" className="gb-line" strokeWidth={1.8} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M22.5 35.5 L30.5 33.5 L33 39.5 L24.5 41.5 Z" className="gb-mug" strokeWidth={1.4} strokeLinejoin="round" />
          <circle cx={21} cy={46} r={1.3} className="gb-shell" strokeWidth={1} />
        </g>
      )}

      {/* Chair back, behind him (pushed in while he naps on the desk). */}
      {!out && <path d="M33 59V43a7 7 0 0 1 7-7h23a7 7 0 0 1 7 7v16" className="gb-chair" strokeWidth={1.8} />}

      {/* GuildBot, at the desk. Asleep on it when out of asks. */}
      {!away && (
        <g data-part="bot">
          <g transform={out ? 'translate(27 25) rotate(-12 32 58) scale(0.62)' : 'translate(29.5 19) scale(0.68)'}>
            <BotHead expression={face} genie={genie} status={status} />
          </g>
          {out && <Zzz x={64} y={26} />}
          <path data-part="exclaim" d="M78 8v8M78 20.5v.5" className="gb-line" strokeWidth={2.6} strokeLinecap="round" />
        </g>
      )}

      {/* Plant (the lamp takes its spot at night). */}
      <g display={lamp ? 'none' : undefined}>
        <path d="M10 49c-3-6 0-11 2-12 1 4 1 8-2 12ZM14 49c0-7 4-10 7-10-1 5-3 8-7 10ZM12 50c-5-2-7-6-6-9 3 1 6 4 6 9Z" className="gb-leaf" strokeWidth={1.2} strokeLinejoin="round" />
        <path d="M7.5 50h11l-1.6 8h-7.8Z" className="gb-pot" strokeWidth={1.4} strokeLinejoin="round" />
      </g>

      {/* Desk: top face, front edge, legs. */}
      <path d="M8 57.5h104l4 4.5H4Z" className="gb-wood-top" strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M4 62h112v5.5H4Z" className="gb-wood-front" strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M10 67.5V86M110 67.5V86" className="gb-line" strokeWidth={2.4} strokeLinecap="round" />

      {/* Laptop, or shut when he's out of asks. */}
      {out ? (
        <path d="M68 60.5h28l-1.6-3H69.6Z" className="gb-laptop" strokeWidth={1.4} strokeLinejoin="round" />
      ) : (
        <g>
          <path d="M72 58.5 74 35.5l22-3-1.5 26Z" className="gb-laptop" strokeWidth={1.6} strokeLinejoin="round" />
          <g data-part="code" strokeLinecap="round" strokeWidth={1.8}>
            <path d="M77.5 40.5h9" stroke="#F7A851" />
            <path d="M79.5 45h11" stroke="#3DB88A" />
            <path d="M79.5 49.5h6" stroke="#9A7BD4" />
            <path d="M77.5 54h10" stroke="#F7A851" />
          </g>
          <path d="M66 60.5h30l-1.8-2.4H68Z" className="gb-laptop" strokeWidth={1.4} strokeLinejoin="round" />
        </g>
      )}

      {/* Hands on the keys (or one under his head, asleep). */}
      {!away && !out && (
        <g>
          <rect data-hand="l" x={52} y={56} width={7.5} height={4} rx={2} className="gb-shell" strokeWidth={1.4} />
          <rect data-hand="r" x={61} y={56} width={7.5} height={4} rx={2} className="gb-shell" strokeWidth={1.4} />
        </g>
      )}
    </>
  )
}

function Cushion({ face, genie, away, status }: { face: Expression; genie: boolean; away: boolean; status: AvatarStatus | null }) {
  return (
    <>
      {/* Plant, on the floor. */}
      <g transform="translate(-2 26)">
        <path d="M10 49c-3-6 0-11 2-12 1 4 1 8-2 12ZM14 49c0-7 4-10 7-10-1 5-3 8-7 10ZM12 50c-5-2-7-6-6-9 3 1 6 4 6 9Z" className="gb-leaf" strokeWidth={1.2} strokeLinejoin="round" />
        <path d="M7.5 50h11l-1.6 8h-7.8Z" className="gb-pot" strokeWidth={1.4} strokeLinejoin="round" />
      </g>
      {/* Cushion. */}
      <ellipse cx={52} cy={80} rx={27} ry={6.5} className="gb-cushion" strokeWidth={1.6} />
      <path d="M28 79q24 6 48 0" className="gb-line" strokeOpacity={0.25} strokeWidth={1.2} fill="none" />

      {!away && (
        <g data-part="bot">
          <g data-part="float">
            {/* Crossed legs, body, hands resting on the knees. */}
            <path d="M30 73q22-9 44 0q-22 7-44 0Z" className="gb-foot" strokeLinejoin="round" />
            <rect x={40} y={52} width={24} height={20} rx={9} className="gb-shell" strokeWidth={1.8} />
            <path d="M42 58q-10 6-10 14M62 58q10 6 10 14" className="gb-line" strokeWidth={1.8} fill="none" strokeLinecap="round" />
            <circle cx={32} cy={72} r={2.6} className="gb-shell" strokeWidth={1.4} />
            <circle cx={72} cy={72} r={2.6} className="gb-shell" strokeWidth={1.4} />
            <g transform="translate(30 14) scale(0.66)">
              <BotHead expression={face} genie={genie} status={status} />
            </g>
          </g>
          <path data-part="sparkle" d="M20 30l1 2.8 2.8 1-2.8 1-1 2.8-1-2.8-2.8-1 2.8-1Z" className="gb-sparkle" />
          <path data-part="sparkle" d="M84 22l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8Z" className="gb-sparkle" />
          <path data-part="exclaim" d="M76 6v8M76 18.5v.5" className="gb-line" strokeWidth={2.6} strokeLinecap="round" />
        </g>
      )}
    </>
  )
}

/** His saffron mug: the asks left are written on it. Sits on (x, y) as its base. */
function Mug({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path data-part="steam" d="M4 -17c-2-3 2-4.5 0-7.5" className="gb-steam" strokeWidth={1.4} fill="none" strokeLinecap="round" />
      <path data-part="steam" d="M8.5 -17c-2-3 2-4.5 0-7.5" className="gb-steam" strokeWidth={1.4} fill="none" strokeLinecap="round" />
      <path d="M12.5 -11.5a3.6 3.6 0 0 1 0 7" className="gb-line" strokeWidth={2} fill="none" strokeLinecap="round" />
      <path d="M0 -14h13v10.5a3.5 3.5 0 0 1-3.5 3.5h-6A3.5 3.5 0 0 1 0-3.5Z" className="gb-mug" strokeWidth={1.6} strokeLinejoin="round" />
    </g>
  )
}

/** Genie mode: a small gold lamp in the mug's place, blue smoke curling up. */
function GenieLamp({ x, y }: { x: number; y: number }) {
  const line = { stroke: '#4A3210', strokeWidth: 1.4, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  return (
    <g transform={`translate(${x} ${y})`}>
      <path data-part="steam" d="M19 -14c-3-3 3-5 0-8s4-5 1-8" fill="none" stroke="#7FB2FF" strokeWidth={2} strokeLinecap="round" />
      <path data-part="sparkle" d="M13 -26l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8Z" fill="#BFD8FF" />
      <path d="M3 -8c0-4 12-4 12 0" fill="#E0A93B" {...line} />
      <path d="M0 -8h16c3 0 5-2 7-4.5-1.2 4-3.6 7.5-8 8.3C13.6-2.6 11.4-2 9-2s-4.6-.6-6-1.8C1-5 0-6.4 0-8Z" fill="#E7B54A" {...line} />
      <path d="M5 -2l-1 2h10l-1-2" fill="#C99430" {...line} />
    </g>
  )
}

function OutSign({ y }: { y: number }) {
  return (
    <g transform={`translate(0 ${y})`}>
      <path d="M99 62 102.5 48h13l3.5 14Z" className="gb-pot" strokeWidth={1.4} strokeLinejoin="round" />
      <text x={109} y={58} textAnchor="middle" fontSize={6.2} fontWeight={800} className="gb-sign-text">OUT</text>
    </g>
  )
}

function Zzz({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} className="gb-zzz" fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path data-z d="M0 0h4l-4 4h4" strokeWidth={1.4} />
      <path data-z d="M6 -8h5l-5 5h5" strokeWidth={1.6} />
    </g>
  )
}
