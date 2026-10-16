'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { activityAt, type Activity, type Expression, type Variant } from '@guildboard/guildbot'
import { Mitten, PlushFigure, plushEdge, type AvatarStatus, type PlushColour } from '@/components/guildbot/PlushBot'
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
 * A cup only shows up when he's actually having coffee. In the last three
 * asks a genie's lamp sits beside him and he turns blue; with none left an
 * OUT card stands there, and he carries on with his day. Colours come from the theme
 * (.gb-scene in globals.css), so light and dark both work.
 */
export type Scene = Activity | 'meeting' | 'garden' | 'rainwatch'
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
    case 'garden':
    case 'rainwatch': return 'relieved'
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
  garden: 'floor',
  rainwatch: 'floor',
}

export function GuildBotScene({
  scene,
  asks,
  left,
  expression,
  colour = 'smug',
  reacting = false,
  status = null,
  knocking = false,
  away = false,
  doorOpen = false,
  doorway,
  trick = null,
  variant = null,
  mug = true,
  width = 120,
}: {
  scene: Scene
  asks: Asks
  /** Asks left this week, for the sign at his house; null for guests. */
  left: number | null
  /** His mood, or a live reaction. */
  expression: Expression
  /** His felt colour: the month's mood, genie blue, or meeting plum. */
  colour?: PlushColour
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
  /** Today's version of the activity: iced coffee, a tiffin lunch, the guitar. */
  variant?: Variant
  /** The genie lamp or the OUT sign, when the asks call for one. Off on the focus page. */
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
  // Genie blue for the last three asks, otherwise his mood's own colour.
  const paint: PlushColour = genie ? 'genie' : colour
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
        {stage === 'desk' && <Desk scene={shown} face={face} colour={paint} away={away} status={status} variant={variant} />}
        {stage === 'cushion' && <Cushion scene={shown} face={face} colour={paint} away={away} status={status} variant={variant} />}
        {stage === 'floor' && (shown === 'garden' || shown === 'rainwatch'
          ? <Outdoors scene={shown} face={face} colour={paint} away={away} status={status} />
          : <Floor scene={shown} face={face} colour={paint} away={away} status={status} />)}
        {trick === 'pat' && !away && <Hearts />}
        {mug && (genie ? <GenieLamp x={mugX - 4} y={floorY} /> : out ? <OutSign y={floorY} /> : null)}
      </svg>
    </span>
  )
}

type Hand = { x: number; y: number; side: 'l' | 'r' }

/** Where the desk scenes put his hands (the mittens drawn on the desk). */
function deskHands(scene: Scene): Hand[] {
  switch (scene) {
    case 'coding': return [{ x: 57, y: 57, side: 'l' }, { x: 65, y: 57, side: 'r' }]
    case 'coffee': return [{ x: 63, y: 50, side: 'r' }]
    case 'lunch': return [{ x: 69, y: 43, side: 'r' }]
    case 'learning': return [{ x: 36, y: 55, side: 'l' }, { x: 66, y: 55, side: 'r' }]
    case 'meeting': return [{ x: 47, y: 56, side: 'l' }, { x: 55, y: 56, side: 'r' }]
    default: return []
  }
}

/**
 * The faint arm lines to the hands a scene draws itself, from the plush's
 * shoulders (it sits at `from`, scaled by s). Drawn before the plush, so
 * they come out from behind the felt like his own.
 */
function Arms({ from, to, colour }: { from: { x: number; y: number; s: number }; to: Hand[]; colour: PlushColour }) {
  if (!to.length) return null
  return (
    <g stroke={plushEdge(colour)} strokeOpacity={0.45} strokeWidth={1.8 * from.s} strokeLinecap="round" fill="none">
      {to.map(h => {
        const sx = from.x + from.s * (h.side === 'l' ? 18 : 82)
        const sy = from.y + from.s * 62
        return <path key={`${h.x}-${h.y}`} d={`M${sx} ${sy}L${h.x} ${h.y}`} />
      })}
    </g>
  )
}

type Part = { face: Expression; colour: PlushColour; away: boolean; status: AvatarStatus | null }

/** What he's doing, as plush status: thought dots or sound lines. */
const plushStatus = (s: AvatarStatus | null) => (s === 'thinking' ? 'thinking' : s === 'talking' ? 'talking' : null)

function Plant({ dy = 0 }: { dy?: number }) {
  return (
    <g transform={dy ? `translate(-2 ${dy})` : undefined}>
      <path d="M10 49c-3-6 0-11 2-12 1 4 1 8-2 12ZM14 49c0-7 4-10 7-10-1 5-3 8-7 10ZM12 50c-5-2-7-6-6-9 3 1 6 4 6 9Z" className="gb-leaf" strokeWidth={1.2} strokeLinejoin="round" />
      <path d="M7.5 50h11l-1.6 8h-7.8Z" className="gb-pot" strokeWidth={1.4} strokeLinejoin="round" />
    </g>
  )
}

function Desk({ scene, face, colour, away, status, variant }: Part & { scene: Scene; variant: Variant }) {
  const sulking = scene === 'meeting'
  return (
    <>
      <Plant />

      {/* Chair back. */}
      <path d="M33 59V43a7 7 0 0 1 7-7h23a7 7 0 0 1 7 7v16" className="gb-chair" strokeWidth={1.8} />

      {!away && (
        <g data-part="bot" className="gb-plush" data-motion="idle">
          {/* The plush, sat behind his desk (the desk top hides his bottom). */}
          <Arms from={{ x: 27, y: 15, s: 0.46 }} to={deskHands(scene)} colour={colour} />
          <g transform="translate(27 15) scale(0.46)">
            <PlushFigure colour={colour} expression={face} status={plushStatus(status)} hands="none" fuzzy={false} />
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
              <g data-hand="l"><Mitten x={57} y={57} colour={colour} rot={-90} /></g>
              <g data-hand="r"><Mitten x={65} y={57} colour={colour} rot={-90} /></g>
            </g>
          )}
          {scene === 'coffee' && (
            <g data-part="sip">
              {variant === 'iced' ? (
                // Too warm for hot coffee: iced, with a straw.
                <>
                  <path d="M60 32l2 6" className="gb-line" strokeWidth={1.4} strokeLinecap="round" />
                  <path d="M56 37h9l-1 11h-7Z" fill="#E8D4BC" fillOpacity={0.85} className="gb-line" strokeWidth={1.3} strokeLinejoin="round" />
                  <rect x={57.5} y={39} width={2.6} height={2.6} rx={0.6} fill="#FFFFFF" opacity={0.8} />
                  <rect x={60.5} y={41.5} width={2.6} height={2.6} rx={0.6} fill="#FFFFFF" opacity={0.8} />
                </>
              ) : (
                <>
                  <path d="M59.5 36c-1.6-2 1.6-3 0-5" className="gb-steam-on" strokeWidth={1.2} fill="none" strokeLinecap="round" />
                  <path d="M56 38h9v7.5a2.5 2.5 0 0 1-2.5 2.5h-4A2.5 2.5 0 0 1 56 45.5Z" className="gb-mug" strokeWidth={1.4} strokeLinejoin="round" />
                </>
              )}
              <Mitten x={63} y={50} colour={colour} flip rot={10} />
            </g>
          )}
          {scene === 'lunch' && (
            <g>
              {variant === 'tiffin' ? (
                // A stacked steel tiffin, lids off.
                <g>
                  <rect x={42} y={52} width={10} height={8} rx={1.5} fill="#C9CED6" className="gb-line" strokeWidth={1.2} />
                  <rect x={53} y={50} width={10} height={10} rx={1.5} fill="#D7DCE3" className="gb-line" strokeWidth={1.2} />
                  <path d="M44 54h6M55 52.5h6" stroke="#E8B64B" strokeWidth={2} strokeLinecap="round" />
                </g>
              ) : (
                <>
                  <path d="M42 54h22c0 5-5 7.5-11 7.5S42 59 42 54Z" className="gb-pot" strokeWidth={1.5} strokeLinejoin="round" />
                  <path d="M45 54q3-3 6 0t6 0 5 0" className="gb-noodle" strokeWidth={1.6} fill="none" strokeLinecap="round" />
                </>
              )}
              <g data-part="chopsticks">
                <path d="M66 42 55 53M68.5 43.5 57 54" className="gb-line" strokeWidth={1.4} strokeLinecap="round" />
                <Mitten x={69} y={43} colour={colour} flip rot={-20} />
              </g>
            </g>
          )}
          {scene === 'learning' && (
            <g data-part="book">
              <path d="M37 45.5 51 48v12l-14-2.5Z" className="gb-page" strokeWidth={1.4} strokeLinejoin="round" />
              <path d="M65 45.5 51 48v12l14-2.5Z" className="gb-page" strokeWidth={1.4} strokeLinejoin="round" />
              <path d="M40 49.5l8 1.4M40 52.5l8 1.4M54 50.9l8-1.4M54 53.9l8-1.4" className="gb-line" strokeOpacity={0.35} strokeWidth={1} />
              <Mitten x={36} y={55} colour={colour} rot={20} />
              <Mitten x={66} y={55} colour={colour} flip rot={-20} />
            </g>
          )}
          {sulking && (
            <g>
              {/* Mittens crossed, in protest. */}
              <Mitten x={47} y={56} colour={colour} rot={-60} />
              <Mitten x={55} y={56} colour={colour} flip rot={60} />
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

function Cushion({ scene, face, colour, away, status, variant }: Part & { scene: Scene; variant: Variant }) {
  const music = scene === 'music'
  return (
    <>
      <Plant dy={26} />
      <ellipse cx={52} cy={80} rx={27} ry={6.5} className="gb-cushion" strokeWidth={1.6} />
      <path d="M28 79q24 6 48 0" className="gb-line" strokeOpacity={0.25} strokeWidth={1.2} fill="none" />

      {!away && (
        <g data-part="bot">
          <g data-part={music ? 'groove' : 'float'}>
            {/* The plush, floating a little over his cushion. */}
            <g transform="translate(29 25) scale(0.5)" className="gb-plush" data-motion="still">
              <PlushFigure colour={colour} expression={face} status={plushStatus(status)} wear={music && variant !== 'guitar' ? 'headphones' : null} hands={music && variant === 'guitar' ? 'one' : 'rest'} fuzzy={false} />
            </g>
            {music && variant === 'guitar' && (
              // A tiny guitar, strummed by a floating mitten.
              <g>
                <Arms from={{ x: 29, y: 25, s: 0.5 }} to={[{ x: 46, y: 74, side: 'r' }]} colour={colour} />
                <path d="M60 64l20-12" stroke="#8B5A3C" strokeWidth={3.4} strokeLinecap="round" />
                <path d="M78 50l5-3" stroke="#3A2E22" strokeWidth={4} strokeLinecap="round" />
                <ellipse cx={50} cy={70} rx={12} ry={8.5} fill="#D9893F" className="gb-line" strokeWidth={1.3} />
                <circle cx={52} cy={69} r={2.6} fill="#3A2E22" />
                <g data-part="strum"><Mitten x={46} y={74} colour={colour} rot={-30} /></g>
              </g>
            )}
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

function Floor({ scene, face, colour, away, status }: Part & { scene: Scene }) {
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
          {/* Standing on the floor: stretching tall, scrubbing, or hopping along. */}
          <g transform="translate(34 26) scale(0.55)" className="gb-plush" data-motion={scene === 'walking' ? 'walk' : scene === 'waking' ? 'stretch' : 'idle'}>
            <PlushFigure colour={colour} expression={face} status={plushStatus(status)} hands={scene === 'brushing' ? 'brush' : 'rest'} fuzzy={false} />
          </g>
          <path data-part="exclaim" d="M90 12v8M90 24.5v.5" className="gb-line" strokeWidth={2.6} strokeLinecap="round" />
        </g>
      )}
    </>
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

/** Walk time, but the weather said no: the garden in the heat, or the window in the rain. */
function Outdoors({ scene, face, colour, away, status }: Part & { scene: Scene }) {
  const garden = scene === 'garden'
  return (
    <>
      {garden ? (
        <g>
          {/* Sun, a shady tree, grass. */}
          <circle cx={100} cy={18} r={7} fill="#F6C431" opacity={0.9} />
          <path d="M22 80V52" stroke="#7A4A2E" strokeWidth={4} strokeLinecap="round" />
          <circle cx={22} cy={42} r={16} className="gb-leaf" strokeWidth={1.4} />
          <circle cx={12} cy={50} r={9} className="gb-leaf" strokeWidth={1.4} />
          <path d="M0 80h120" stroke="#16774F" strokeWidth={3} strokeOpacity={0.5} />
          <path d="M6 80l2-4 2 4M40 80l2-4 2 4M92 80l2-4 2 4M108 80l2-4 2 4" stroke="#16774F" strokeWidth={1.2} fill="none" strokeOpacity={0.7} />
        </g>
      ) : (
        <g>
          {/* A window with the rain coming down behind him. */}
          <rect x={30} y={8} width={60} height={50} rx={3} fill="#3A4A66" className="gb-line" strokeWidth={2} />
          <path d="M60 8v50M30 33h60" className="gb-line" strokeWidth={1.6} />
          <g className="gb-rain" stroke="#A9C7F2" strokeWidth={1.2} strokeLinecap="round">
            <path data-drop d="M38 14l-2 6M50 22l-2 6M70 12l-2 6M82 24l-2 6M44 38l-2 6M76 40l-2 6" />
          </g>
          <path d="M0 80h120" className="gb-line" strokeOpacity={0.15} strokeWidth={1.2} />
        </g>
      )}
      {!away && (
        <g data-part="bot">
          <Arms from={{ x: 36, y: 31, s: 0.5 }} to={[{ x: garden ? 86 : 85, y: garden ? 74 : 72, side: 'r' }]} colour={colour} />
          <g transform="translate(36 31) scale(0.5)" className="gb-plush" data-motion="idle">
            <PlushFigure colour={colour} expression={face} status={plushStatus(status)} hands="one" fuzzy={false} />
          </g>
          {garden ? (
            // Lemonade.
            <g>
              <path d="M76 66h8l-1 12h-6Z" fill="#F6E27A" fillOpacity={0.85} className="gb-line" strokeWidth={1.2} strokeLinejoin="round" />
              <path d="M81 66l3-6" className="gb-line" strokeWidth={1.2} strokeLinecap="round" />
              <circle cx={78} cy={66} r={2.2} fill="#9BCB4C" />
              <Mitten x={86} y={74} colour={colour} flip rot={10} />
            </g>
          ) : (
            // Chai, in a little glass.
            <g>
              <path d="M78 62c-1.4-2 1.4-3 0-5" className="gb-steam-on" strokeWidth={1.1} fill="none" strokeLinecap="round" />
              <path d="M75 64h8l-1 9h-6Z" fill="#C98A4B" className="gb-line" strokeWidth={1.2} strokeLinejoin="round" />
              <Mitten x={85} y={72} colour={colour} flip rot={10} />
            </g>
          )}
          <path data-part="exclaim" d="M90 12v8M90 24.5v.5" className="gb-line" strokeWidth={2.6} strokeLinecap="round" />
        </g>
      )}
    </>
  )
}
