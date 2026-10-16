'use client'

import { useEffect, useRef, useState, type CSSProperties } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Sparkle } from '@phosphor-icons/react/dist/ssr'
import type { Expression } from '@guildboard/guildbot'
import { cn } from '@/lib/utils/cn'
import { GuildBotAvatar, type AvatarStatus } from '@/components/guildbot/GuildBotAvatar'
import { GuildBotScene, type Asks, type Scene, type Trick as SceneTrick } from '@/components/guildbot/GuildBotScene'
import type { Bubble, Chip, Trick } from '@/components/guildbot/useGuildBotLife'

export type Knock = 'idle' | 'knocking' | 'door'

/** How far GuildBot strolls out along the bottom edge on desktop, in px. */
const STROLL = 140
const STROLL_MS = 1100

/**
 * GuildBot's corner of the screen: the scene he's in (GuildBotScene), which
 * is the chat button, what he says, and his menu.
 *
 *  - A reaction: he hops and pulls the face. A big one (with a line) on
 *    desktop: he gets up, strolls out along the bottom edge, says it, and
 *    goes back. On phones he stays put; at night he leans out of his door.
 *  - Tapped: see GuildBotChat. He startles and answers (at night, you knock).
 *  - Chat open: he gets up from whatever he was doing and comes over to
 *    help. On desktop he stands at the dock's edge, on phones on top of the
 *    sheet, and what he's doing for you shows on him. His spot stays empty
 *    until you close the chat.
 *  - The ✦ beside him: his menu. Tricks (he gets tired), focus with him,
 *    quiet for today, shoo.
 */
export function GuildBotStage({
  scene,
  asks,
  left,
  expression,
  reacting,
  hop,
  bubble,
  onDismissBubble,
  onChip,
  knock,
  greeting,
  lightsOut,
  open,
  desktop,
  drawerWidth,
  phoneSheetBottom,
  status,
  trick,
  onTrick,
  energy,
  hidden,
  quiet,
  onQuiet,
  onHide,
  reduce,
  dodge,
  label,
  onPress,
}: {
  scene: Scene
  asks: Asks
  left: number | null
  expression: Expression
  reacting: boolean
  hop: number
  bubble: Bubble | null
  onDismissBubble: () => void
  onChip: (chip: Chip) => void
  knock: Knock
  greeting: string | null
  lightsOut: string | null
  open: boolean
  desktop: boolean
  drawerWidth: number
  /** Where the top of the phone sheet is, as a CSS length from the bottom. */
  phoneSheetBottom: string
  status: AvatarStatus | null
  trick: SceneTrick
  onTrick: (t: Trick) => void
  /** Energy left (0 to max), read when the menu opens. */
  energy: () => { now: number; max: number }
  hidden: boolean
  quiet: boolean
  onQuiet: () => void
  onHide: (on: boolean) => void
  reduce: boolean
  dodge: string | null
  label: string
  onPress: (e: React.MouseEvent) => void
}) {
  const genie = asks === 'genie'
  const atHouse = scene === 'sleeping'
  const stroll = useStroll(bubble, desktop && !open && !hidden && !reduce && !atHouse)
  const [menu, setMenu] = useState<{ now: number; max: number } | null>(null)
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
  const say = lightsOut ?? (knock === 'door' ? greeting : null) ?? (open ? null : bubble?.text ?? dodge)
  const width = desktop ? 124 : 100

  // Over at the chat: where he stands.
  const helper: CSSProperties = desktop ? { right: drawerWidth + 10, bottom: 10 } : { right: 14, bottom: `calc(${phoneSheetBottom} - 10px)` }

  return (
    <>
      <div
        className={cn(
          'fixed right-2 bottom-20 md:right-4 md:bottom-2 flex items-end z-(--z-overlay) transition-transform duration-300 motion-reduce:transition-none',
          dodge !== null && '-translate-x-24 -translate-y-16',
        )}
      >
        {/* What he says, with answers to tap when he's asking. */}
        {say && !open && (
          <div
            role="status"
            className="absolute bottom-full mb-1 w-[min(17rem,calc(100vw-2rem))] animate-fade-up transition-[right] duration-700 ease-(--motion-in-out)"
            style={{ right: strolling ? STROLL - 24 : 8 }}
          >
            <div className="relative rounded-2xl border border-border-strong bg-paper px-3.5 py-2.5 text-[13px] leading-snug text-ink shadow-lg">
              <span className="block text-caption font-semibold text-ink-soft mb-0.5">GuildBot</span>
              {say}
              {bubble?.chips && say === bubble.text && (
                <span className="mt-2 flex flex-wrap gap-1.5">
                  {bubble.chips.map(c => (
                    <button key={c.label} type="button" onClick={() => onChip(c)} className="press h-7 px-2.5 rounded-full border border-border-strong bg-sumi text-[12px] text-ink hover:bg-kinu">
                      {c.label}
                    </button>
                  ))}
                </span>
              )}
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
            className="absolute bottom-1 left-6 pointer-events-none"
            initial={{ transform: 'translateX(0px)', opacity: 0 }}
            animate={{ transform: `translateX(${stroll === 'out' || stroll === 'walking-out' ? -STROLL : 0}px)`, opacity: 1 }}
            transition={{ transform: { duration: STROLL_MS / 1000, ease: [0.77, 0, 0.175, 1] }, opacity: { duration: 0.2 } }}
          >
            <span key={hop} className="gb-hop block">
              <GuildBotAvatar expression={expression} size={56} genie={genie} walking={stroll === 'walking-out' || stroll === 'walking-in'} follow />
            </span>
          </motion.div>
        )}

        {/* His menu. */}
        {!open && (
          <div className="absolute -top-1 left-0 z-10">
            <button
              type="button"
              onClick={() => setMenu(m => (m ? null : energy()))}
              aria-label="GuildBot's menu"
              aria-expanded={!!menu}
              className="press inline-flex items-center justify-center w-6 h-6 rounded-full border border-border bg-paper/90 text-ink-soft shadow-sm hover:text-saffron"
            >
              <Sparkle className="w-3.5 h-3.5" weight="fill" />
            </button>
            {menu && (
              <div role="menu" className="absolute bottom-full left-0 mb-2 w-52 max-w-[calc(100vw-1rem)] -translate-x-[calc(13rem-124px)] md:-translate-x-[calc(13rem-124px)] rounded-(--radius-card) border border-border-strong bg-paper p-1 shadow-lg text-[13px]">
                <p className="px-2.5 pt-1.5 pb-1 flex items-center justify-between text-caption text-cha">
                  Energy
                  <span aria-label={`${menu.now} of ${menu.max}`} className="inline-flex gap-0.5">
                    {Array.from({ length: menu.max }, (_, i) => (
                      <span key={i} className={cn('w-1.5 h-3 rounded-sm', i < menu.now ? 'bg-saffron' : 'bg-fill-strong')} />
                    ))}
                  </span>
                </p>
                {!hidden && (['dance', 'pat', 'coffee', 'meditate'] as const).map(t => (
                  <MenuItem key={t} onClick={() => { onTrick(t); setMenu(null) }}>
                    {t === 'dance' ? 'Dance' : t === 'pat' ? 'Pat on the head' : t === 'coffee' ? 'Bring him a coffee' : 'Meditate together'}
                  </MenuItem>
                ))}
                <Link role="menuitem" href="/focus" onClick={() => setMenu(null)} className="block rounded-md px-2.5 leading-8 hover:bg-kinu/60 text-ink">
                  Focus with me
                </Link>
                <div className="my-1 border-t border-border" />
                {!hidden && <MenuItem onClick={() => { onQuiet(); setMenu(null) }}>{quiet ? 'Talk again' : 'Quiet for today'}</MenuItem>}
                <MenuItem onClick={() => { onHide(!hidden); setMenu(null) }}>{hidden ? 'Bring back the antics' : 'Shoo, no antics'}</MenuItem>
              </div>
            )}
          </div>
        )}

        {/* The scene: the chat button. */}
        <button
          type="button"
          onClick={onPress}
          aria-expanded={open}
          aria-label={label}
          className="relative rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4"
        >
          <span key={atHouse ? 'house' : hop} className={cn('block', !atHouse && !strolling && hop > 0 && 'gb-hop')}>
            <GuildBotScene
              scene={scene}
              asks={asks}
              left={left}
              expression={expression}
              reacting={reacting}
              knocking={knock !== 'idle'}
              away={strolling || open}
              trick={trick}
              doorOpen={knock === 'door' || peek || !!lightsOut}
              doorway={
                hidden ? null : (
                  <span key={hop} className="gb-hop block">
                    <GuildBotAvatar expression={lightsOut ? 'sleepy' : expression} size={22} feet={false} genie={genie} />
                  </span>
                )
              }
              width={width}
            />
          </span>
        </button>
      </div>

      {/* Over at the chat, helping. */}
      {open && (
        <motion.div
          className={cn('fixed pointer-events-none', desktop ? 'z-(--z-overlay)' : 'z-55')}
          style={helper}
          initial={reduce ? { opacity: 0 } : { transform: 'translateX(60px)', opacity: 0 }}
          animate={reduce ? { opacity: 1 } : { transform: 'translateX(0px)', opacity: 1 }}
          transition={{ duration: 0.6, ease: [0.23, 1, 0.32, 1] }}
        >
          <GuildBotAvatar expression={expression} status={status} size={desktop ? 76 : 52} genie={genie} feet={desktop} follow />
        </motion.div>
      )}
    </>
  )
}

function MenuItem({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button role="menuitem" type="button" onClick={onClick} className="w-full text-left rounded-md px-2.5 h-8 hover:bg-kinu/60 text-ink">
      {children}
    </button>
  )
}

type Stroll = 'home' | 'walking-out' | 'out' | 'walking-in'

/** The walk out and back for a big reaction: out, stand while the bubble shows, back in. */
function useStroll(bubble: Bubble | null, enabled: boolean): Stroll {
  const [stroll, setStroll] = useState<Stroll>('home')
  const id = bubble?.id
  const chips = !!bubble?.chips
  useEffect(() => {
    // Small talk waits for your answer at his spot: no stroll for that.
    if (!id || !enabled || chips) return
    const t = [
      setTimeout(() => setStroll('walking-out'), 200),
      setTimeout(() => setStroll('out'), 200 + STROLL_MS),
      setTimeout(() => setStroll('walking-in'), 6000),
      setTimeout(() => setStroll('home'), 6000 + STROLL_MS),
    ]
    return () => t.forEach(clearTimeout)
  }, [id, enabled, chips])
  return enabled ? stroll : 'home'
}
