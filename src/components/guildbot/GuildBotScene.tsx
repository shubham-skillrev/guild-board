'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { activityAt, type Activity, type Expression } from '@guildboard/guildbot'
import { cn } from '@/lib/utils/cn'
import { BotFigure, BotHead, type AvatarStatus } from '@/components/guildbot/GuildBotAvatar'
import { GuildBotHome } from '@/components/guildbot/GuildBotHome'

/**
 * GuildBot's corner, as a little scene of whatever he's doing: his day runs
 * on the viewer's clock (schedule.ts in the package), so it's coffee in the
 * morning, coding through the day, noodles at lunch, a walk, a book,
 * headphones, meditation, and asleep in his house at night.
 *
 * A few stages carry every activity, with props swapped in:
 *
 *   desk     coding, coffee, lunch, learning, and the meeting sulk
 *   cushion  meditating, music
 *   floor    waking (a big stretch), brushing, walking
 *   house    sleeping (GuildBotHome)
 *
 * The asks left this week are written on his saffron mug. In the last three
 * the mug becomes a genie's lamp and his eyes go blue; with none left an OUT
 * card stands where the mug was, and he carries on with his day. Colours come from the theme
 * (.gb-scene in globals.css), so light and dark both work.
 */
export type Scene = Activity | 'meeting'
export type Asks = 'normal' | 'genie' | 'out'
export type Trick = 'dance' | 'pat' | null

/** His activity now, rechecked every minute. Null until mounted (no server guess). */
export function useActivity(): Activity | null {
  const [a, setA] = useState<Activity | null>(null)
  useEffect(() => {
    const check = () => setA(activityAt(new Date()))
    const first = setTimeout(check, 0)
    const id = setInterval(check, 60_000)
    return () => { clearTimeout(first); clearInterval(id) }
  }, [])
  return a
}

/** The face an activity wears when nothing has just happened. */
function restingFace(scene: Scene, mood: Expression): Expression {
  switch (scene) {
    case 'meeting': return 'grumpy'
    case 'waking':
    case 'sleeping': return 'sleepy'
    case 'coffee':
    case 'meditating': return 'relieved'
    case 'brushing':
    case 'lunch':
    case 'music': return 'proud'
    case 'learning': return 'nosy'
    default: return mood
  }
}

const STAGE: Record<Scene, 'desk' | 'cushion' | 'floor' | 'house'> = {
  sleeping: 'house',
  waking: 'floor',
  brushing: 'floor',
  coffee: 'desk',
  coding: 'desk',
  lunch: 'desk',
  walking: 'floor',
  learning: 'desk',
  music: 'cushion',
  meditating: 'cushion',
  meeting: 'desk',
}

export function GuildBotScene({
  scene,
  asks,
  left,
  expression,
  reacting = false,
  status = null,
  knocking = false,
  away = false,
  doorOpen = false,
  doorway,
  trick = null,
  mug = true,
  width = 120,
}: {
  scene: Scene
  asks: Asks
  /** Asks left this week, for the mug; null for guests. */
  left: number | null
  /** His mood, or a live reaction. */
  expression: Expression
  /** True while a reaction is showing: its face beats the activity's own. */
  reacting?: boolean
  status?: AvatarStatus | null
  knocking?: boolean
  /** He's out (strolling, or over at the chat): an empty spot. */
  away?: boolean
  /** Asleep in the house: its door, and who stands in it. */
  doorOpen?: boolean
  doorway?: ReactNode
  trick?: Trick
  /** His mug (with the asks left on it, or the genie lamp, or the OUT sign). Off on the focus page. */
  mug?: boolean
  width?: number
}) {
  const out = asks === 'out'
  // Out of asks changes nothing about his day: only the OUT card where his mug was.
  const shown: Scene = scene
  const stage = STAGE[shown]
  if (stage === 'house') {
    return (
      <GuildBotHome
        look="night"
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
  const face: Expression = reacting || trick ? expression : restingFace(shown, expression)
  const floorY = stage === 'desk' ? 62 : 84
  const mugX = stage === 'desk' ? 100 : 98
  return (
    <span
      className="gb-scene relative inline-block"
      style={{ width, height: (width * 90) / 120 }}
      data-scene={shown}
      data-knock={knocking ? '' : undefined}
      data-status={status ?? undefined}
      data-trick={trick ?? undefined}
    >
      <svg viewBox="0 0 120 90" className="absolute inset-0 w-full h-full overflow-visible" aria-hidden>
        <ellipse cx={60} cy={86.5} rx={54} ry={3.2} fill="#000" opacity={0.12} />
        {stage === 'desk' && <Desk scene={shown} face={face} genie={genie} away={away} status={status} />}
        {stage === 'cushion' && <Cushion scene={shown} face={face} genie={genie} away={away} status={status} />}
        {stage === 'floor' && <Floor scene={shown} face={face} genie={genie} away={away} status={status} />}
        {trick === 'pat' && !away && <Hearts />}
        {mug && (genie ? <GenieLamp x={mugX - 4} y={floorY} /> : out ? <OutSign y={floorY} /> : <Mug x={mugX} y={floorY} />)}
      </svg>
      {mug && left !== null && !out && (
        <span
          aria-hidden
          className={cn(
            'absolute -translate-x-1/2 -translate-y-1/2 text-[11px] font-bold tabular-nums leading-none',
            genie ? 'min-w-4.5 h-4.5 px-1 inline-flex items-center justify-center rounded-full bg-indigo-jp text-white shadow-sm' : 'text-parchment',
          )}
          style={stage === 'desk'
            ? { left: genie ? '94%' : '88.3%', top: genie ? '75%' : '62%' }
            : { left: genie ? '92%' : '86.6%', top: genie ? '98%' : '86%' }}
        >
          {left}
        </span>
      )}
    </span>
  )
}

type Part = { face: Expression; genie: boolean; away: boolean; status: AvatarStatus | null }

function Plant({ dy = 0 }: { dy?: number }) {
  return (
    <g transform={dy ? `translate(-2 ${dy})` : undefined}>
      <path d="M10 49c-3-6 0-11 2-12 1 4 1 8-2 12ZM14 49c0-7 4-10 7-10-1 5-3 8-7 10ZM12 50c-5-2-7-6-6-9 3 1 6 4 6 9Z" className="gb-leaf" strokeWidth={1.2} strokeLinejoin="round" />
      <path d="M7.5 50h11l-1.6 8h-7.8Z" className="gb-pot" strokeWidth={1.4} strokeLinejoin="round" />
    </g>
  )
}

function Desk({ scene, face, genie, away, status }: Part & { scene: Scene }) {
  const sulking = scene === 'meeting'
  return (
    <>
      <Plant />

      {/* Chair back. */}
      <path d="M33 59V43a7 7 0 0 1 7-7h23a7 7 0 0 1 7 7v16" className="gb-chair" strokeWidth={1.8} />

      {!away && (
        <g data-part="bot">
          <g transform="translate(29.5 19) scale(0.68)">
            <BotHead expression={face} genie={genie} status={status} />
          </g>
          {sulking && <Fumes />}
          <path data-part="exclaim" d="M78 8v8M78 20.5v.5" className="gb-line" strokeWidth={2.6} strokeLinecap="round" />
        </g>
      )}

      {/* Desk: top face, front edge, legs. */}
      <path d="M8 57.5h104l4 4.5H4Z" className="gb-wood-top" strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M4 62h112v5.5H4Z" className="gb-wood-front" strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M10 67.5V86M110 67.5V86" className="gb-line" strokeWidth={2.4} strokeLinecap="round" />

      {/* What's on the desk. */}
      {sulking ? (
        <MeetingSign />
      ) : (
        <Laptop open={scene === 'coding' || scene === 'coffee'} />
      )}

      {!away && (
        <>
          {scene === 'coding' && (
            <g>
              <rect data-hand="l" x={52} y={56} width={7.5} height={4} rx={2} className="gb-shell" strokeWidth={1.4} />
              <rect data-hand="r" x={61} y={56} width={7.5} height={4} rx={2} className="gb-shell" strokeWidth={1.4} />
            </g>
          )}
          {scene === 'coffee' && (
            <g data-part="sip">
              <path d="M59.5 36c-1.6-2 1.6-3 0-5" className="gb-steam-on" strokeWidth={1.2} fill="none" strokeLinecap="round" />
              <path d="M56 38h9v7.5a2.5 2.5 0 0 1-2.5 2.5h-4A2.5 2.5 0 0 1 56 45.5Z" className="gb-mug" strokeWidth={1.4} strokeLinejoin="round" />
              <ellipse cx={60.5} cy={49} rx={4.5} ry={2.4} className="gb-shell" strokeWidth={1.3} />
            </g>
          )}
          {scene === 'lunch' && (
            <g>
              <path d="M42 54h22c0 5-5 7.5-11 7.5S42 59 42 54Z" className="gb-pot" strokeWidth={1.5} strokeLinejoin="round" />
              <path d="M45 54q3-3 6 0t6 0 5 0" className="gb-noodle" strokeWidth={1.6} fill="none" strokeLinecap="round" />
              <g data-part="chopsticks">
                <path d="M66 42 55 53M68.5 43.5 57 54" className="gb-line" strokeWidth={1.4} strokeLinecap="round" />
                <ellipse cx={68} cy={42.5} rx={3.6} ry={2.3} className="gb-shell" strokeWidth={1.3} />
              </g>
            </g>
          )}
          {scene === 'learning' && (
            <g data-part="book">
              <path d="M37 45.5 51 48v12l-14-2.5Z" className="gb-page" strokeWidth={1.4} strokeLinejoin="round" />
              <path d="M65 45.5 51 48v12l14-2.5Z" className="gb-page" strokeWidth={1.4} strokeLinejoin="round" />
              <path d="M40 49.5l8 1.4M40 52.5l8 1.4M54 50.9l8-1.4M54 53.9l8-1.4" className="gb-line" strokeOpacity={0.35} strokeWidth={1} />
              <ellipse cx={36} cy={54} rx={3} ry={2.2} className="gb-shell" strokeWidth={1.3} />
              <ellipse cx={66} cy={54} rx={3} ry={2.2} className="gb-shell" strokeWidth={1.3} />
            </g>
          )}
          {sulking && (
            <g>
              {/* Arms crossed. */}
              <rect x={42} y={54} width={16} height={5} rx={2.5} className="gb-shell" strokeWidth={1.4} transform="rotate(-10 50 56)" />
              <rect x={46} y={54} width={16} height={5} rx={2.5} className="gb-shell" strokeWidth={1.4} transform="rotate(10 54 56)" />
            </g>
          )}
        </>
      )}
    </>
  )
}

function Laptop({ open }: { open: boolean }) {
  if (!open) {
    // Pushed aside, lid half down.
    return (
      <g>
        <path d="M80 58.5 84 44l18-2-2.6 16.5Z" className="gb-laptop" strokeWidth={1.5} strokeLinejoin="round" />
        <path d="M76 60.5h26l-1.8-2.4H78Z" className="gb-laptop" strokeWidth={1.4} strokeLinejoin="round" />
      </g>
    )
  }
  return (
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
  )
}

function MeetingSign() {
  return (
    <g>
      <path d="M70 58 72.5 37h23l2.5 21Z" className="gb-page" strokeWidth={1.5} strokeLinejoin="round" />
      <text x={84} y={45.5} textAnchor="middle" fontSize={5.4} fontWeight={800} className="gb-sign-text">MEETING</text>
      <text x={84} y={51.5} textAnchor="middle" fontSize={4.2} className="gb-sign-text">in progress</text>
      <text x={84} y={56} textAnchor="middle" fontSize={3.6} fontStyle="italic" className="gb-sign-muted">(not invited)</text>
    </g>
  )
}

function Cushion({ scene, face, genie, away, status }: Part & { scene: Scene }) {
  const music = scene === 'music'
  return (
    <>
      <Plant dy={26} />
      <ellipse cx={52} cy={80} rx={27} ry={6.5} className="gb-cushion" strokeWidth={1.6} />
      <path d="M28 79q24 6 48 0" className="gb-line" strokeOpacity={0.25} strokeWidth={1.2} fill="none" />

      {!away && (
        <g data-part="bot">
          <g data-part={music ? 'groove' : 'float'}>
            <path d="M30 73q22-9 44 0q-22 7-44 0Z" className="gb-foot" strokeLinejoin="round" />
            <rect x={40} y={52} width={24} height={20} rx={9} className="gb-shell" strokeWidth={1.8} />
            <path d="M42 58q-10 6-10 14M62 58q10 6 10 14" className="gb-line" strokeWidth={1.8} fill="none" strokeLinecap="round" />
            <circle cx={32} cy={72} r={2.6} className="gb-shell" strokeWidth={1.4} />
            <circle cx={72} cy={72} r={2.6} className="gb-shell" strokeWidth={1.4} />
            <g transform="translate(30 14) scale(0.66)">
              <BotHead expression={face} genie={genie} status={status} headphones={music} />
            </g>
          </g>
          {music ? (
            <>
              <Note x={80} y={26} />
              <Note x={18} y={34} />
            </>
          ) : (
            <>
              <path data-part="sparkle" d="M20 30l1 2.8 2.8 1-2.8 1-1 2.8-1-2.8-2.8-1 2.8-1Z" className="gb-sparkle" />
              <path data-part="sparkle" d="M84 22l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8Z" className="gb-sparkle" />
            </>
          )}
          <path data-part="exclaim" d="M76 6v8M76 18.5v.5" className="gb-line" strokeWidth={2.6} strokeLinecap="round" />
        </g>
      )}
    </>
  )
}

function Floor({ scene, face, genie, away, status }: Part & { scene: Scene }) {
  return (
    <>
      {scene === 'waking' && (
        // The sun coming up behind him.
        <g>
          <path d="M8 80a16 16 0 0 1 32 0Z" className="gb-sun" />
          <path d="M24 58v-5M10 64l-3.5-3.5M38 64l3.5-3.5" className="gb-sun-ray" strokeWidth={1.8} strokeLinecap="round" />
        </g>
      )}
      {scene === 'walking' && (
        // The pavement going by.
        <g data-part="path" className="gb-line" strokeWidth={1.6} strokeLinecap="round" strokeOpacity={0.4}>
          <path d="M4 82h10M26 82h10M48 82h10M70 82h10M92 82h10M114 82h10" />
        </g>
      )}
      <path d="M2 80h86" className="gb-line" strokeOpacity={0.15} strokeWidth={1.2} />

      {!away && (
        <g data-part="bot">
          <g transform="translate(36 17) scale(0.8)">
            <BotFigure
              expression={face}
              genie={genie}
              status={status}
              pose={scene === 'walking' ? 'walk' : scene === 'waking' ? 'stretch' : 'brush'}
            />
          </g>
          <path data-part="exclaim" d="M90 12v8M90 24.5v.5" className="gb-line" strokeWidth={2.6} strokeLinecap="round" />
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

/** No asks left this week: a little OUT card where the mug stands (base at y). */
function OutSign({ y }: { y: number }) {
  return (
    <g transform={`translate(0 ${y - 62})`}>
      <path d="M99 62 102.5 48h13l3.5 14Z" className="gb-pot" strokeWidth={1.4} strokeLinejoin="round" />
      <text x={109} y={58} textAnchor="middle" fontSize={6.2} fontWeight={800} className="gb-sign-text">OUT</text>
    </g>
  )
}


/** Steam off his head: the meeting he wasn't invited to. */
function Fumes() {
  return (
    <g className="gb-fumes">
      <path data-fume d="M44 14c-3 0-3.6-4 0-4.6 0-3 4.6-3 5 0 3.4 0 3.4 4.6 0 4.6Z" />
      <path data-fume d="M58 12c-2.4 0-3-3.2 0-3.7 0-2.4 3.7-2.4 4 0 2.7 0 2.7 3.7 0 3.7Z" />
    </g>
  )
}

function Note({ x, y }: { x: number; y: number }) {
  return (
    // The animation moves the inner group; the outer one places it.
    <g transform={`translate(${x} ${y})`}>
      <g data-part="note">
        <path d="M3 0v8.5" className="gb-note-line" strokeWidth={1.4} strokeLinecap="round" />
        <path d="M3 0l5 1.6v2.4L3 2.4Z" className="gb-note" />
        <ellipse cx={1.4} cy={8.8} rx={2.2} ry={1.6} className="gb-note" />
      </g>
    </g>
  )
}

function Hearts() {
  return (
    <g className="gb-hearts">
      <path data-heart d="M50 18c-2-3-6-1-4 2l4 4 4-4c2-3-2-5-4-2Z" />
      <path data-heart d="M66 12c-1.5-2.4-4.6-.8-3.2 1.6l3.2 3.2 3.2-3.2c1.4-2.4-1.7-4-3.2-1.6Z" />
    </g>
  )
}
