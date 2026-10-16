'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { motion } from 'framer-motion'
import type { Expression } from '@guildboard/guildbot'
import { cn } from '@/lib/utils/cn'
import { GuildBotAvatar, type AvatarStatus } from '@/components/guildbot/GuildBotAvatar'
import { GuildBotScene, type Activity, type Asks } from '@/components/guildbot/GuildBotScene'
import type { Bubble } from '@/components/guildbot/useGuildBotLife'

export type Knock = 'idle' | 'knocking' | 'door'

/** How far GuildBot strolls out along the bottom edge on desktop, in px. */
const STROLL = 140
const STROLL_MS = 1100

/**
 * GuildBot's corner of the screen: the scene he's in (GuildBotScene: coding,
 * meditating, or asleep in his house at night), which is the chat button,
 * and what he says.
 *
 *  - A reaction: he hops and pulls the face. A big one (with a line) on
 *    desktop: he gets up, strolls out along the bottom edge, says it, and
 *    goes back to what he was doing. On phones he stays put: the screen is
 *    too narrow to walk across without covering cards. At night he leans out
 *    of his front door instead.
 *  - Tapped: see GuildBotChat. He startles and answers (at night, you knock
 *    and he opens the door).
 *  - Chat open: no house, whatever the hour. He's at his desk working for
 *    you, beside the dock on desktop, on top of the sheet on phones, and
 *    what he's doing shows on him.
 *
 * Tap him while he's out strolling for the shoo menu: quiet for today, or no
 * antics at all.
 */
export function GuildBotStage({
  activity,
  night,
  asks,
  left,
  expression,
  hop,
  bubble,
  onDismissBubble,
  knock,
  greeting,
  lightsOut,
  open,
  desktop,
  drawerWidth,
  phoneSheetBottom,
  status,
  hidden,
  quiet,
  onQuiet,
  onHide,
  reduce,
  dodge,
  label,
  onPress,
}: {
  activity: Activity
  night: boolean
  asks: Asks
  left: number | null
  expression: Expression
  hop: number
  bubble: Bubble | null
  onDismissBubble: () => void
  knock: Knock
  greeting: string | null
  lightsOut: string | null
  open: boolean
  desktop: boolean
  drawerWidth: number
  /** Where the top of the phone sheet is, as a CSS length from the bottom. */
  phoneSheetBottom: string
  status: AvatarStatus | null
  hidden: boolean
  quiet: boolean
  onQuiet: () => void
  onHide: () => void
  reduce: boolean
  dodge: string | null
  label: string
  onPress: (e: React.MouseEvent) => void
}) {
  const genie = asks === 'genie'
  const scene: Activity = open ? 'coding' : activity
  const atHouse = scene === 'night'
  const stroll = useStroll(bubble, desktop && !open && !hidden && !reduce && !atHouse)
  const [menu, setMenu] = useState(false)
  const [peek, setPeek] = useState(false)

  // A reaction at night: he leans out of his door for a moment.
  const lastHop = useRef(hop)
  useEffect(() => {
    if (hop === lastHop.current) return
    lastHop.current = hop
    if (hidden || open || !atHouse) return
    const on = setTimeout(() => setPeek(true), 0)
    const off = setTimeout(() => setPeek(false), 2600)
    return () => { clearTimeout(on); clearTimeout(off) }
  }, [hop, hidden, open, atHouse])

  const strolling = stroll !== 'home'
  const say = lightsOut ?? (knock === 'door' ? greeting : null) ?? (open || hidden ? null : bubble?.text ?? dodge)
  const width = open ? (desktop ? 124 : 92) : desktop ? 124 : 100

  const position: CSSProperties = open
    ? desktop
      ? { right: drawerWidth + 8, bottom: 8 }
      : { right: 12, bottom: phoneSheetBottom }
    : {}

  return (
    <div
      className={cn(
        'fixed flex items-end transition-[right,bottom,transform] duration-500 ease-(--ease-drawer) motion-reduce:transition-none',
        !open && 'right-2 bottom-[5rem] md:right-4 md:bottom-2',
        open && !desktop ? 'z-[55]' : 'z-(--z-overlay)',
        dodge !== null && '-translate-x-24 -translate-y-16',
      )}
      style={position}
    >
      {/* What he says. */}
      {say && (
        <div
          role="status"
          className="absolute bottom-full mb-1 w-[min(17rem,calc(100vw-2rem))] animate-fade-up transition-[right] duration-700 ease-(--ease-in-out)"
          // Over him while he's out strolling, over the scene otherwise.
          style={{ right: strolling ? STROLL - 24 : 8 }}
        >
          <div className="relative rounded-2xl border border-border-strong bg-paper px-3.5 py-2.5 text-[13px] leading-snug text-ink shadow-lg">
            <span className="block text-caption font-semibold text-ink-soft mb-0.5">GuildBot</span>
            {say}
            {bubble && say === bubble.text && (
              <button type="button" onClick={onDismissBubble} aria-label="Dismiss" className="absolute top-1.5 right-2 text-cha hover:text-ink text-[14px] leading-none">×</button>
            )}
            <span aria-hidden className="absolute -bottom-1.5 right-14 h-3 w-3 rotate-45 border-r border-b border-border-strong bg-paper" />
          </div>
        </div>
      )}

      {/* Out for a stroll along the bottom edge (desktop, big reactions). */}
      {strolling && (
        <motion.div
          className="absolute bottom-1 left-6"
          initial={{ transform: 'translateX(0px)', opacity: 0 }}
          animate={{ transform: `translateX(${stroll === 'out' || stroll === 'walking-out' ? -STROLL : 0}px)`, opacity: 1 }}
          transition={{ transform: { duration: STROLL_MS / 1000, ease: [0.77, 0, 0.175, 1] }, opacity: { duration: 0.2 } }}
        >
          <button
            type="button"
            onClick={() => setMenu(m => !m)}
            aria-label="GuildBot. Options"
            aria-expanded={menu}
            className="block rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            <span key={hop} className="gb-hop block">
              <GuildBotAvatar expression={expression} size={56} genie={genie} walking={stroll === 'walking-out' || stroll === 'walking-in'} follow />
            </span>
          </button>
          {menu && (
            <div role="menu" className="absolute bottom-full left-0 mb-2 w-48 rounded-(--radius-card) border border-border-strong bg-paper p-1 shadow-lg text-[13px]">
              <button role="menuitem" type="button" onClick={() => { onQuiet(); setMenu(false) }} className="w-full text-left rounded-md px-2.5 h-8 hover:bg-kinu/60 text-ink">
                {quiet ? 'Talk again' : 'Quiet for today'}
              </button>
              <button role="menuitem" type="button" onClick={() => { onHide(); setMenu(false) }} className="w-full text-left rounded-md px-2.5 h-8 hover:bg-kinu/60 text-ink">
                Shoo, no antics
              </button>
            </div>
          )}
        </motion.div>
      )}

      {/* The scene: the chat button. */}
      <button
        type="button"
        onClick={onPress}
        aria-expanded={open}
        aria-label={open ? 'Close chat with GuildBot' : label}
        className="relative rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4"
      >
        <span key={atHouse ? 'house' : hop} className={cn('block', !atHouse && !strolling && hop > 0 && 'gb-hop')}>
          <GuildBotScene
            activity={scene}
            asks={asks}
            left={left}
            expression={expression}
            status={open ? status : null}
            knocking={knock !== 'idle'}
            away={strolling}
            doorOpen={knock === 'door' || peek || !!lightsOut}
            doorway={
              hidden ? null : (
                <span key={hop} className="gb-hop block">
                  <GuildBotAvatar expression={lightsOut ? 'sleepy' : expression} size={22} feet={false} genie={genie} />
                </span>
              )
            }
            lamp={open && night}
            width={width}
          />
        </span>
      </button>
    </div>
  )
}

type Stroll = 'home' | 'walking-out' | 'out' | 'walking-in'

/** The walk out and back for a big reaction: out, stand while the bubble shows, back in. */
function useStroll(bubble: Bubble | null, enabled: boolean): Stroll {
  const [stroll, setStroll] = useState<Stroll>('home')
  const id = bubble?.id
  useEffect(() => {
    if (!id || !enabled) return
    const t = [
      setTimeout(() => setStroll('walking-out'), 200),
      setTimeout(() => setStroll('out'), 200 + STROLL_MS),
      setTimeout(() => setStroll('walking-in'), 6000),
      setTimeout(() => setStroll('home'), 6000 + STROLL_MS),
    ]
    return () => t.forEach(clearTimeout)
  }, [id, enabled])
  return enabled ? stroll : 'home'
}
