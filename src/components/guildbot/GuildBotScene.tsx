'use client'

import { useEffect, useState } from 'react'
import { activityAt, type Activity, type Expression, type Variant } from '@guildboard/guildbot'
import type { AvatarStatus, KersColour } from '@/components/kers/look'
import { Kers, type KersState } from '@/components/kers/Kers'
import type { KersPose } from '@/components/kers/poses'
import type { CursorPlay } from '@/components/kers/useCursorPlay'

/**
 * GuildBot's corner, as a little scene of whatever Kers is doing: his day
 * runs on the viewer's clock (schedule.ts in the package), so it's coffee in
 * the morning, the laptop through the day, lunch, a walk, a book, music,
 * meditation, and curled up asleep under a blanket at night (a knock or a
 * reaction wakes him: he sits up and rubs an eye).
 *
 * Each scene is three layers: the room behind him (SVG), Kers himself (a
 * rendered pose, components/kers), and what's in front of him (SVG props:
 * a bowl, a guitar, the meeting sign, the genie lamp). A cup only shows up
 * when he's having coffee. In the last three asks a genie's lamp sits beside
 * him and he turns blue; with none left an OUT card stands there,
 * and he carries on with his day. Colours come from the theme (.gb-scene in
 * globals.css), so light and dark both work.
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

/** What the chat's status means for his cursor states. */
export function kersState(status: AvatarStatus | null): KersState {
  return status === 'thinking' || status === 'searching' ? 'thinking' : status === 'writing' ? 'writing' : null
}

/**
 * Where Kers stands in each scene: the pose, his height as a share of the
 * scene's, and where his middle sits (percent across) and his feet (percent
 * up from the bottom).
 */
/** Where he sits behind the desk. */
const DESK = { h: 0.75, x: 45, y: 16 }

const STAGING: Record<Scene, { pose: KersPose; h: number; x: number; y: number }> = {
  // At his desk (the desk's front hides his lower half).
  sleeping: { pose: 'desk-asleep', ...DESK },
  coding: { pose: 'desk-typing', ...DESK },
  coffee: { pose: 'desk-mug', ...DESK },
  lunch: { pose: 'desk-lunch', ...DESK },
  learning: { pose: 'desk-reading', ...DESK },
  meditating: { pose: 'meditating', h: 0.92, x: 52, y: 2 },
  music: { pose: 'sitting', h: 0.86, x: 52, y: 4 },
  waking: { pose: 'arms-up', h: 0.94, x: 56, y: 3 },
  brushing: { pose: 'brushing', h: 0.92, x: 54, y: 3 },
  walking: { pose: 'standing', h: 0.92, x: 50, y: 4 },
  garden: { pose: 'sitting', h: 0.8, x: 54, y: 5 },
  rainwatch: { pose: 'mug', h: 0.82, x: 54, y: 4 },
  meeting: { pose: 'desk-sulk', ...DESK },
}
const DESK_SCENES = new Set<Scene>(['sleeping', 'coding', 'coffee', 'lunch', 'learning', 'meeting'])

export function GuildBotScene({
  scene,
  asks,
  expression,
  colour = 'smug',
  reacting = false,
  status = null,
  knocking = false,
  away = false,
  doorOpen = false,
  trick = null,
  variant = null,
  mug = true,
  cursor = null,
  play = null,
  width = 120,
}: {
  scene: Scene
  asks: Asks
  /** His mood, or a live reaction. */
  expression: Expression
  /** His fill: the month's mood, genie blue, or meeting plum. */
  colour?: KersColour
  /** True while a reaction is showing: its face beats the activity's own. */
  reacting?: boolean
  status?: AvatarStatus | null
  knocking?: boolean
  /** He's out (strolling, or over at the chat): an empty spot. */
  away?: boolean
  /** Asleep, and woken for a moment (a knock, or a reaction): he sits up rubbing an eye. */
  doorOpen?: boolean
  trick?: Trick
  /** Today's version of the activity: iced coffee, a tiffin lunch, the guitar. */
  variant?: Variant
  /** The genie lamp or the OUT sign, when the asks call for one. Off on the focus page. */
  mug?: boolean
  /** A cursor state for a moment (click ripple, ⊘), over whatever he's doing. */
  cursor?: KersState
  /** Reacting to your cursor: pointing, leaning in, flinching. */
  play?: CursorPlay
  width?: number
}) {
  const genie = asks === 'genie'
  const out = asks === 'out'
  const paint: KersColour = genie ? 'genie' : scene === 'meeting' ? 'meeting' : colour
  const face: Expression = reacting || trick ? expression : restingFace(scene, expression)
  const height = (width * 90) / 120
  const stage = STAGING[scene]
  const awake = scene === 'sleeping' && (knocking || doorOpen)
  const atDesk = DESK_SCENES.has(scene)
  const pose: KersPose = awake ? 'desk-rubbing' : stage.pose
  const guitar = scene === 'music' && variant === 'guitar'

  return (
    <span
      className="gb-scene relative inline-block"
      style={{ width, height }}
      data-scene={scene}
      data-knock={knocking ? '' : undefined}
      data-status={status ?? undefined}
      data-trick={trick ?? undefined}
    >
      {/* Behind him. */}
      <svg viewBox="0 0 120 90" className="absolute inset-0 w-full h-full overflow-visible" aria-hidden>
        <ellipse cx={60} cy={86.5} rx={50} ry={3.2} fill="#000" opacity={0.12} />
        <Backdrop scene={scene} />
      </svg>

      {!away && (
        <span
          data-part="bot"
          className="absolute block -translate-x-1/2"
          style={{ left: `${stage.x}%`, bottom: `${stage.y}%` }}
        >
          <Kers
            pose={trick === 'dance' ? 'arms-up' : pose}
            motion={trick === 'dance' ? 'dance' : scene === 'walking' ? 'walk' : awake ? 'hop' : 'idle'}
            colour={paint}
            expression={awake ? 'sleepy' : face}
            state={cursor ?? kersState(status)}
            play={play}
            special={trick === 'pat' ? 'heart' : reacting && expression === 'dramatic' ? 'swirl' : null}
            wear={scene === 'music' && !guitar ? 'headphones' : null}
            size={Math.round(height * stage.h)}
          />
        </span>
      )}

      {/* In front of him. */}
      <svg viewBox="0 0 120 90" className="absolute inset-0 w-full h-full overflow-visible pointer-events-none" aria-hidden>
        {/* His desk stays put while he's off on a walk or dancing; only what he's holding goes with him. */}
        {atDesk ? <DeskFront scene={scene} variant={variant} away={away} /> : !away && <Foreground scene={scene} guitar={guitar} />}
        {trick === 'pat' && !away && <Hearts />}
        {mug && (genie ? <GenieLamp x={atDesk ? 96 : 98} y={atDesk ? 57.5 : 86} /> : out ? <OutSign y={atDesk ? 62 : 86} /> : null)}
      </svg>
    </span>
  )
}

/** The room behind him. */
function Backdrop({ scene }: { scene: Scene }) {
  switch (scene) {
    case 'coding':
    case 'coffee':
    case 'learning':
    case 'lunch':
    case 'meeting':
      // His desk's back half: the plant on it, his chair.
      return (
        <g>
          <Plant />
          <path d="M30 59V40a8 8 0 0 1 8-8h26a8 8 0 0 1 8 8v19" className="gb-chair" strokeWidth={1.8} />
        </g>
      )
    case 'music':
      return <Plant dy={28} />
    case 'meditating':
      return (
        <g>
          <Plant dy={28} />
          <path data-part="sparkle" d="M22 30l1.2 3.3 3.3 1.2-3.3 1.2-1.2 3.3-1.2-3.3-3.3-1.2 3.3-1.2Z" className="gb-sparkle" />
          <path data-part="sparkle" d="M96 22l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9Z" className="gb-sparkle" />
        </g>
      )
    case 'waking':
      // The sun coming up behind him.
      return (
        <g>
          <path d="M8 86a18 18 0 0 1 36 0Z" className="gb-sun" />
          <path d="M26 61v-5M10 68l-3.5-3.5M42 68l3.5-3.5" className="gb-sun-ray" strokeWidth={1.8} strokeLinecap="round" />
        </g>
      )
    case 'walking':
      // The pavement going by.
      return (
        <g data-part="path" className="gb-line" strokeWidth={1.6} strokeLinecap="round" strokeOpacity={0.4}>
          <path d="M4 87h10M26 87h10M48 87h10M70 87h10M92 87h10M114 87h10" />
        </g>
      )
    case 'garden':
      return (
        <g>
          <circle cx={104} cy={14} r={7} fill="#F6C431" opacity={0.9} />
          <path d="M18 86V54" stroke="#7A4A2E" strokeWidth={4} strokeLinecap="round" />
          <circle cx={18} cy={44} r={15} className="gb-leaf" strokeWidth={1.4} />
          <circle cx={9} cy={52} r={8} className="gb-leaf" strokeWidth={1.4} />
          <path d="M0 86h120" stroke="#16774F" strokeWidth={3} strokeOpacity={0.5} />
          <path d="M40 86l2-4 2 4M92 86l2-4 2 4M108 86l2-4 2 4" stroke="#16774F" strokeWidth={1.2} fill="none" strokeOpacity={0.7} />
        </g>
      )
    case 'sleeping':
      // Night at his desk: a moon, a few stars, the plant, his chair.
      return (
        <g>
          <Plant />
          <path d="M30 59V40a8 8 0 0 1 8-8h26a8 8 0 0 1 8 8v19" className="gb-chair" strokeWidth={1.8} />
          <path d="M100 8a10 10 0 1 0 8 16 8 8 0 1 1-8-16Z" fill="#F4E7B8" />
          <circle cx={22} cy={14} r={1.2} fill="#F4E7B8" />
          <circle cx={40} cy={6} r={0.9} fill="#F4E7B8" />
          <circle cx={84} cy={30} r={1} fill="#F4E7B8" />
        </g>
      )
    case 'rainwatch':
      return (
        <g>
          <rect x={26} y={4} width={68} height={52} rx={3} fill="#3A4A66" className="gb-line" strokeWidth={2} />
          <path d="M60 4v52M26 30h68" className="gb-line" strokeWidth={1.6} />
          <g className="gb-rain" stroke="#A9C7F2" strokeWidth={1.2} strokeLinecap="round">
            <path data-drop d="M34 10l-2 6M48 18l-2 6M72 8l-2 6M86 20l-2 6M40 36l-2 6M80 38l-2 6" />
          </g>
        </g>
      )
    default:
      return null
  }
}

/** What's in front of him: his desk and what's on it, the guitar, lemonade. */
function Foreground({ scene, guitar }: { scene: Scene; guitar: boolean }) {
  if (guitar) {
    return (
      <g transform="translate(-4 4)">
        <path d="M66 66l20-12" stroke="#8B5A3C" strokeWidth={3.4} strokeLinecap="round" />
        <path d="M84 52l5-3" stroke="#3A2E22" strokeWidth={4} strokeLinecap="round" />
        <ellipse cx={56} cy={72} rx={13} ry={9} fill="#D9893F" className="gb-line" strokeWidth={1.3} />
        <circle cx={58} cy={71} r={2.8} fill="#3A2E22" />
      </g>
    )
  }
  if (scene === 'music') return <g><Note x={90} y={30} /><Note x={22} y={36} /></g>
  if (scene === 'garden') {
    return (
      <g transform="translate(86 70)">
        <path d="M0 0h9l-1 14h-7Z" fill="#F6E27A" fillOpacity={0.9} className="gb-line" strokeWidth={1.2} strokeLinejoin="round" />
        <path d="M6 0l3-6" className="gb-line" strokeWidth={1.2} strokeLinecap="round" />
        <circle cx={2} cy={0} r={2.4} fill="#9BCB4C" />
      </g>
    )
  }
  return null
}

/** His desk's front half, and what's on it for the scene. */
function DeskFront({ scene, variant, away }: { scene: Scene; variant: Variant; away: boolean }) {
  return (
    <g>
      {/* Desk: top face, front edge, legs. */}
      <path d="M8 57.5h104l4 4.5H4Z" className="gb-wood-top" strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M4 62h112v5.5H4Z" className="gb-wood-front" strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M10 67.5V86M110 67.5V86" className="gb-line" strokeWidth={2.4} strokeLinecap="round" />

      {scene === 'meeting' ? <MeetingSign /> : scene === 'sleeping' ? null : <Laptop open={scene === 'coding' || scene === 'coffee'} />}

      {scene === 'coffee' && (
        <g data-part="sip">
          {variant === 'iced' ? (
            // Too warm for hot coffee: iced, with a straw.
            <>
              <path d="M62 33l2 6" className="gb-line" strokeWidth={1.4} strokeLinecap="round" />
              <path d="M58 38h9l-1 11h-7Z" fill="#E8D4BC" fillOpacity={0.9} className="gb-line" strokeWidth={1.3} strokeLinejoin="round" />
              <rect x={59.5} y={40} width={2.6} height={2.6} rx={0.6} fill="#FFFFFF" opacity={0.8} />
              <rect x={62.5} y={42.5} width={2.6} height={2.6} rx={0.6} fill="#FFFFFF" opacity={0.8} />
            </>
          ) : (
            <>
              <path d="M61.5 37c-1.6-2 1.6-3 0-5" className="gb-steam-on" strokeWidth={1.2} fill="none" strokeLinecap="round" />
              <path d="M58 39h9v7.5a2.5 2.5 0 0 1-2.5 2.5h-4A2.5 2.5 0 0 1 58 46.5Z" className="gb-mug" strokeWidth={1.4} strokeLinejoin="round" />
            </>
          )}
        </g>
      )}
      {scene === 'lunch' && (
        variant === 'tiffin' ? (
          <g>
            <rect x={38} y={49} width={10} height={8.5} rx={1.5} fill="#C9CED6" className="gb-line" strokeWidth={1.2} />
            <rect x={49} y={47} width={10} height={10.5} rx={1.5} fill="#D7DCE3" className="gb-line" strokeWidth={1.2} />
            <path d="M40 51h6M51 49.5h6" stroke="#E8B64B" strokeWidth={2} strokeLinecap="round" />
            <g data-part="chopsticks"><path d="M68 41 57 52M70.5 42.5 59 53" className="gb-line" strokeWidth={1.4} strokeLinecap="round" /></g>
          </g>
        ) : (
          <g>
            <path d="M38 52.5h24c0 4-5.4 6.5-12 6.5S38 56.5 38 52.5Z" className="gb-pot" strokeWidth={1.5} strokeLinejoin="round" />
            <path d="M41 52.5q3-3 6 0t6 0 6 0" className="gb-noodle" strokeWidth={1.6} fill="none" strokeLinecap="round" />
            <g data-part="chopsticks"><path d="M68 41 57 52M70.5 42.5 59 53" className="gb-line" strokeWidth={1.4} strokeLinecap="round" /></g>
          </g>
        )
      )}
      {scene === 'learning' && (
        <g data-part="book">
          <path d="M36 46 50 48.5v10l-14-2.5Z" className="gb-page" strokeWidth={1.4} strokeLinejoin="round" />
          <path d="M64 46 50 48.5v10l14-2.5Z" className="gb-page" strokeWidth={1.4} strokeLinejoin="round" />
          <path d="M39 50l8 1.4M39 53l8 1.4M53 51.4l8-1.4M53 54.4l8-1.4" className="gb-line" strokeOpacity={0.35} strokeWidth={1} />
        </g>
      )}
      {scene === 'meeting' && !away && <Fumes />}
      {scene === 'sleeping' && (
        <g>
          {/* A dim desk lamp, and z's drifting up off him. */}
          <circle cx={100} cy={44} r={14} fill="#FFD27A" opacity={0.18} />
          <path d="M104 57.5V40l-8-6" className="gb-line" strokeWidth={1.8} strokeLinecap="round" fill="none" />
          <path d="M90 30l10 8-4 4-9-6Z" fill="#E8B04B" className="gb-line" strokeWidth={1.4} strokeLinejoin="round" />
          <path d="M98 57.5h12" className="gb-line" strokeWidth={2.4} strokeLinecap="round" />
          {!away && <g className="gb-zzz" fill="#8A8F9C">
            <text data-z x={66} y={34} fontSize={8} fontWeight={700}>z</text>
            <text data-z x={72} y={26} fontSize={10} fontWeight={700}>z</text>
            <text data-z x={80} y={16} fontSize={12} fontWeight={700}>z</text>
          </g>}
        </g>
      )}
    </g>
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

function Plant({ dy = 0 }: { dy?: number }) {
  return (
    <g transform={dy ? `translate(-2 ${dy})` : undefined}>
      <path d="M10 49c-3-6 0-11 2-12 1 4 1 8-2 12ZM14 49c0-7 4-10 7-10-1 5-3 8-7 10ZM12 50c-5-2-7-6-6-9 3 1 6 4 6 9Z" className="gb-leaf" strokeWidth={1.2} strokeLinejoin="round" />
      <path d="M7.5 50h11l-1.6 8h-7.8Z" className="gb-pot" strokeWidth={1.4} strokeLinejoin="round" />
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

/** Genie mode: a small gold lamp in the mug's place, blue smoke curling up. */
function GenieLamp({ x, y }: { x: number; y: number }) {
  const line = { stroke: '#4A3210', strokeWidth: 1.4, strokeLinejoin: 'round' as const, strokeLinecap: 'round' as const }
  return (
    <g transform={`translate(${x} ${y})`}>
      <path data-part="steam" d="M19 -14c-3-3 3-5 0-8s4-5 1-8" fill="none" stroke="#B48CFF" strokeWidth={2} strokeLinecap="round" />
      <path data-part="sparkle" d="M13 -26l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8Z" fill="#D9C4FF" />
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
