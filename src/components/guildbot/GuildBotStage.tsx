'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import type { Expression, Variant } from '@guildboard/guildbot'
import { cn } from '@/lib/utils/cn'
import type { KersColour } from '@/components/kers/look'
import { Kers } from '@/components/kers/Kers'
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
 *  - Chat open: he leaves his spot for his diary (the dock), where he's an
 *    ink drawing (InkBot). His spot stays empty until you close it.
 *  - Tap him and he asks: talk, or do something? Talking is the knock and the
 *    chat. Doing something opens his actions panel (it stays open): tricks
 *    (he gets tired), a walk, the weather he dresses for, focus with him, and
 *    a way into the chat. He dances standing in front of his desk, and
 *    walks across the bottom of the screen and back (once on a wide screen,
 *    twice on a phone).
 *  - On the focus page he moves out of the corner into the page itself (the
 *    #gb-focus-slot element), bigger, and does the breaks there. He's working
 *    with you there: tapping him does nothing, no chat, no tricks.
 */
export function GuildBotStage({
  scene,
  colour,
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
  trick,
  variant = null,
  doing = null,
  onTrick,
  patrol,
  onPatrolEnd,
  city,
  weatherLabel,
  onCity,
  energy,
  hidden,
  reduce,
  dodge,
  label,
  onPress,
  onTalk,
}: {
  scene: Scene
  /** His felt colour (the chat works it out: mood, genie, meeting). */
  colour: KersColour
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
  trick: SceneTrick
  onTrick: (t: Trick) => void
  /** Today's take on his activity (iced coffee, a tiffin, the guitar). */
  variant?: Variant
  /** What he's up to, in a small bubble over him when he isn't saying anything. */
  doing?: string | null
  /** A walk across the screen is on (its id), and when it's done. */
  patrol: number | null
  onPatrolEnd: () => void
  /** The city he dresses for, from the viewer's browser, and how it's going there. */
  city: string | null
  weatherLabel: string | null
  onCity: (city: string | null) => void
  /** Energy left (0 to max), read when the menu opens. */
  energy: () => { now: number; max: number }
  hidden: boolean
  reduce: boolean
  dodge: string | null
  label: string
  /** Close the chat, or skip a knock in progress. */
  onPress: (e: React.MouseEvent) => void
  /** Talk to him: the knock, then the chat. */
  onTalk: (e: React.MouseEvent) => void
}) {
  const atHouse = scene === 'sleeping'
  const slot = useSlot(usePathname() === '/focus' ? 'gb-focus-slot' : null)
  // On the focus page he stays at his spot in the card: no strolls, no walks across the screen.
  const stroll = useStroll(bubble, desktop && !open && !hidden && !reduce && !atHouse && !patrol && !slot && !trick)
  const walk = usePatrol(patrol, !open && !hidden && !reduce && !atHouse && !slot, onPatrolEnd)
  const dancing = trick === 'dance' && !open && !atHouse
  // Tap him: he asks what you want. "Do something" opens his actions panel,
  // which stays open while he performs; "Let's talk" is the knock.
  const [choice, setChoice] = useState(false)
  const [panel, setPanel] = useState<{ now: number; max: number } | null>(null)
  const [editingCity, setEditingCity] = useState(false)
  useEffect(() => {
    if (!choice && !panel) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { setChoice(false); setPanel(null) } }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [choice, panel])
  const act = (t: Trick) => { onTrick(t); setPanel(energy()) }
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
  const [hiddenDoing, hideDoing] = useHiddenDoing()
  const say = lightsOut ?? (knock === 'door' ? greeting : null) ?? (open ? null : bubble?.text ?? dodge)
  const width = slot ? slot.width : desktop ? 124 : 100


  return (
    <>
      <div
        className={cn(
          'fixed flex items-end z-(--z-overlay) transition-transform duration-300 motion-reduce:transition-none',
          !slot && 'right-2 bottom-20 md:right-4 md:bottom-2',
          dodge !== null && '-translate-x-24 -translate-y-16',
        )}
        style={slot ? { left: slot.left, top: slot.top } : undefined}
      >
        {/* What he says, with answers to tap when he's asking. */}
        {say && !open && !panel && !choice && (
          <div
            role="status"
            className="absolute bottom-full mb-1 w-[min(17rem,calc(100vw-2rem))] animate-fade-up transition-[right] duration-700 ease-(--motion-in-out)"
            // Centred over him in the focus building (kept on screen); over the
            // corner scene, or over him while he strolls, everywhere else.
            style={slot ? slotBubble(slot) : { right: strolling ? STROLL - 24 : 8 }}
          >
            <div className="relative rounded-2xl border border-border-strong bg-paper px-3.5 py-2.5 text-[13px] leading-snug text-ink shadow-lg">
              <span className="block text-caption font-semibold text-ink-soft mb-0.5">Kers</span>
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
              <span aria-hidden className={cn('absolute -bottom-1.5 h-3 w-3 rotate-45 border-r border-b border-border-strong bg-paper', slot ? 'left-1/2 -ml-1.5' : 'right-14')} />
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
              <Kers colour={colour} expression={expression} size={64} motion={stroll === 'walking-out' || stroll === 'walking-in' ? 'walk' : 'idle'} follow />
            </span>
          </motion.div>
        )}

        {/* Tricks he stands up for: in front of the desk, whole body. */}
        {dancing && (
          <span className="absolute bottom-0 left-1/2 -translate-x-1/2 z-[5] pointer-events-none">
            <Kers colour={colour} expression={expression} size={Math.round(width * 0.62)} motion="dance" />
          </span>
        )}

        {/* His walk: across the bottom of the screen and back. */}
        {walk && (
          <motion.div
            className="absolute bottom-0 left-1/4 z-[5] pointer-events-none"
            initial={{ transform: 'translateX(0px)' }}
            animate={{ transform: walk.keyframes }}
            transition={{ duration: walk.seconds, ease: 'linear', times: walk.times }}
            onAnimationComplete={onPatrolEnd}
          >
            <Kers colour={colour} expression={expression} size={desktop ? 68 : 56} motion="walk" />
          </motion.div>
        )}

        {/* What do you want? Talk, or something else. */}
        {choice && !open && (
          <div role="dialog" aria-label="What should Kers do?" className="absolute bottom-full right-2 mb-1 w-[min(16rem,calc(100vw-2rem))] animate-fade-up z-10">
            <div className="relative rounded-2xl border border-border-strong bg-paper px-3.5 py-3 text-[13px] leading-snug text-ink shadow-lg">
              <span className="block text-caption font-semibold text-ink-soft mb-0.5">Kers</span>
              What&apos;ll it be? A chat, or shall I do something?
              <span className="mt-2.5 flex gap-2">
                <button type="button" autoFocus onClick={e => { setChoice(false); onTalk(e) }} className="press flex-1 h-8 rounded-full bg-ink text-parchment text-[13px] font-medium">
                  Let&apos;s talk
                </button>
                <button type="button" onClick={() => { setChoice(false); setPanel(energy()) }} className="press flex-1 h-8 rounded-full border border-border-strong bg-sumi text-[13px] text-ink hover:bg-kinu">
                  Do something
                </button>
              </span>
              <span aria-hidden className="absolute -bottom-1.5 right-14 h-3 w-3 rotate-45 border-r border-b border-border-strong bg-paper" />
            </div>
          </div>
        )}

        {/* His actions: stays open while he performs, until you close it. */}
        {panel && !open && (
          <div role="dialog" aria-label="Kers's actions" className="absolute bottom-full right-2 mb-1 w-[min(17rem,calc(100vw-1.5rem))] animate-fade-up z-10">
            <div className="rounded-2xl border border-border-strong bg-paper p-2 shadow-lg text-[13px]">
              <div className="flex items-center gap-2 px-1.5 pt-0.5 pb-1.5">
                <span className="font-semibold text-ink">Make me do something</span>
                <span aria-label={`Energy ${panel.now} of ${panel.max}`} title="Energy" className="ml-auto inline-flex gap-0.5">
                  {Array.from({ length: panel.max }, (_, i) => (
                    <span key={i} className={cn('w-1.5 h-3 rounded-sm', i < panel.now ? 'bg-saffron' : 'bg-fill-strong')} />
                  ))}
                </span>
                <button type="button" onClick={() => setPanel(null)} aria-label="Close" className="p-1 rounded-full text-cha hover:text-ink hover:bg-kinu/60 leading-none">×</button>
              </div>
              {/* What he just said, here instead of over the panel. */}
              {say && (
                <p role="status" className="mx-1.5 mb-2 rounded-xl bg-sumi px-2.5 py-2 text-[12px] leading-snug text-ink-soft">{say}</p>
              )}
              <div className="grid grid-cols-2 gap-1.5">
                {(['dance', 'walk', 'pat', 'coffee', 'meditate'] as const).map(t => (
                  <button key={t} type="button" onClick={() => act(t)} className="press h-9 rounded-xl border border-border bg-sumi px-2.5 text-left text-ink hover:bg-kinu">
                    {t === 'dance' ? 'Dance' : t === 'walk' ? 'Go for a walk' : t === 'pat' ? 'Pat his head' : t === 'coffee' ? 'Bring coffee' : 'Meditate'}
                  </button>
                ))}
                <Link href="/focus" onClick={() => setPanel(null)} className="press h-9 rounded-xl border border-border bg-sumi px-2.5 leading-9 text-ink hover:bg-kinu">
                  Focus with me
                </Link>
              </div>
              {/* The weather he dresses for: your city, kept in this browser. */}
              {editingCity ? (
                <form
                  className="mt-1.5 flex items-center gap-1"
                  onSubmit={e => {
                    e.preventDefault()
                    onCity(new FormData(e.currentTarget).get('city') as string)
                    setEditingCity(false)
                  }}
                >
                  <input name="city" defaultValue={city ?? ''} autoFocus maxLength={60} placeholder="Your city" aria-label="Your city" className="min-w-0 flex-1 h-8 rounded-md border border-border bg-sumi px-2 text-[13px] text-ink focus:outline-none focus:border-border-strong" />
                  <button type="submit" className="h-8 px-2 rounded-md text-[13px] text-ink hover:bg-kinu/60">Save</button>
                </form>
              ) : (
                <button type="button" onClick={() => setEditingCity(true)} className="mt-1.5 w-full text-left rounded-md px-1.5 h-8 text-ink-soft hover:text-ink hover:bg-kinu/60">
                  {city ? <>Weather: <span className="text-ink">{weatherLabel ?? city}</span> · change</> : 'Dress me for your weather'}
                </button>
              )}
              <button type="button" onClick={e => { setPanel(null); onTalk(e) }} className="press mt-1 w-full h-9 rounded-xl bg-ink text-parchment font-medium">
                Chat with me
              </button>
            </div>
          </div>
        )}

        {/* What he's up to: a small bubble, only while he's home and quiet.
            Hide it and it stays hidden until he moves on to something else. */}
        {doing && doing !== hiddenDoing && !say && !open && !panel && !choice && !hidden && !strolling && !walk && !dancing && (
          <div
            className={cn('absolute bottom-full mb-1 w-max max-w-[min(12.5rem,calc(100vw-2rem))] md:max-w-56', !slot && 'animate-fade-up')}
            style={slot ? { left: slot.width / 2, transform: 'translateX(-50%)' } : { right: 8 }}
          >
            <p className="relative rounded-xl border border-border-strong bg-paper pl-2.5 pr-6 py-1.5 text-[11.5px] leading-snug italic text-ink-soft shadow-[0_8px_24px_-6px_rgba(0,0,0,0.35),0_2px_6px_-2px_rgba(0,0,0,0.2)]">
              {doing}
              <button
                type="button"
                onClick={() => hideDoing(doing)}
                aria-label="Hide what Kers is doing"
                className="absolute top-1 right-1.5 not-italic text-[13px] leading-none text-cha hover:text-ink"
              >
                ×
              </button>
              <span aria-hidden className={cn('absolute -bottom-[5px] h-2.5 w-2.5 rotate-45 border-r border-b border-border-strong bg-paper', slot ? 'left-1/2 -ml-[5px]' : 'right-10')} />
            </p>
          </div>
        )}

        {/* The scene: the chat button. */}
        <button
          type="button"
          onClick={e => {
            // On the focus page he's working with you: not a chat, no tricks.
            if (slot) return
            if (open || knock !== 'idle') { onPress(e); return }
            setPanel(null)
            setChoice(c => !c)
          }}
          tabIndex={slot ? -1 : undefined}
          aria-hidden={slot ? true : undefined}
          aria-expanded={open || choice || !!panel}
          aria-haspopup="dialog"
          aria-label={label}
          className={cn('relative rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4', slot && 'cursor-default')}
        >
          <span key={atHouse ? 'house' : hop} className={cn('block', !atHouse && !strolling && hop > 0 && 'gb-hop')}>
            <GuildBotScene
              scene={scene}
              // On the focus page he's working with you: nothing about chat asks
              // (no mug count, genie lamp, or napping behind an OUT sign).
              asks={slot ? 'normal' : asks}
              left={slot ? null : left}
              mug={!slot}
              expression={expression}
              colour={colour}
              reacting={reacting}
              knocking={knock !== 'idle'}
              away={strolling || open || dancing || !!walk}
              trick={trick}
              variant={variant}
              doorOpen={knock === 'door' || peek || !!lightsOut}
              doorway={
                hidden ? null : (
                  <span key={hop} className="gb-hop block">
                    <Kers colour={colour} expression={lightsOut ? 'sleepy' : expression} size={22} motion="still" />
                  </span>
                )
              }
              width={width}
            />
          </span>
        </button>
      </div>

    </>
  )
}

type Stroll = 'home' | 'walking-out' | 'out' | 'walking-in'

/** The walk out and back for a big reaction: out, stand while the bubble shows, back in. */
function useStroll(bubble: Bubble | null, enabled: boolean): Stroll {
  const [stroll, setStroll] = useState<Stroll>('home')
  const id = bubble?.id
  const stay = !!bubble?.stay
  useEffect(() => {
    // Tricks, walks and small talk happen where he is: no stroll for those.
    if (!id || !enabled || stay) return
    const t = [
      setTimeout(() => setStroll('walking-out'), 200),
      setTimeout(() => setStroll('out'), 200 + STROLL_MS),
      setTimeout(() => setStroll('walking-in'), 6000),
      setTimeout(() => setStroll('home'), 6000 + STROLL_MS),
    ]
    // Cut short (a trick, a walk, the chat): he's back at his spot, not left
    // standing outside while the next thing draws him again at his desk.
    return () => { t.forEach(clearTimeout); setStroll('home') }
  }, [id, enabled, stay])
  return enabled ? stroll : 'home'
}

/** Where an element is on screen, kept current through scroll and resize. Null when it's absent. */
/** A speech bubble centred over him in the focus building, never off screen. */
function slotBubble(slot: DOMRect): React.CSSProperties {
  const width = Math.min(256, window.innerWidth - 32)
  const x = Math.min(Math.max(slot.left + slot.width / 2 - width / 2, 16), window.innerWidth - 16 - width)
  return { left: x - slot.left, width }
}

const HIDE_DOING = 'guildbot:doing-hidden'

/** The status line the viewer hid (this tab only): it comes back once it changes. */
function useHiddenDoing(): [string | null, (text: string) => void] {
  const [hidden, setHidden] = useState<string | null>(null)
  useEffect(() => {
    const t = setTimeout(() => setHidden(sessionStorage.getItem(HIDE_DOING)), 0)
    return () => clearTimeout(t)
  }, [])
  const hide = (text: string) => {
    sessionStorage.setItem(HIDE_DOING, text)
    setHidden(text)
  }
  return [hidden, hide]
}

function useSlot(id: string | null): DOMRect | null {
  const [rect, setRect] = useState<DOMRect | null>(null)
  useEffect(() => {
    if (!id) { const t = setTimeout(() => setRect(null), 0); return () => clearTimeout(t) }
    let frame = 0
    const measure = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const el = document.getElementById(id)
        setRect(el ? el.getBoundingClientRect() : null)
      })
    }
    measure()
    const observer = new ResizeObserver(measure)
    const el = document.getElementById(id)
    if (el) observer.observe(el)
    window.addEventListener('scroll', measure, { passive: true })
    window.addEventListener('resize', measure)
    const late = setTimeout(measure, 300) // the page may mount after us
    return () => {
      cancelAnimationFrame(frame)
      clearTimeout(late)
      observer.disconnect()
      window.removeEventListener('scroll', measure)
      window.removeEventListener('resize', measure)
    }
  }, [id])
  return rect
}

/**
 * A walk across the bottom of the screen and back, at a stroll (150 px/s):
 * one lap where the screen is wide, two on a phone.
 */
function usePatrol(id: number | null, enabled: boolean, onEnd: () => void) {
  const [walk, setWalk] = useState<{ keyframes: string[]; times: number[]; seconds: number } | null>(null)
  useEffect(() => {
    if (!id) { const t = setTimeout(() => setWalk(null), 0); return () => clearTimeout(t) }
    if (!enabled) { onEnd(); return }
    const distance = Math.max(120, window.innerWidth - 220)
    const laps = distance > 700 ? 1 : 2
    const stops = Array.from({ length: laps * 2 + 1 }, (_, i) => (i % 2 ? -distance : 0))
    const t = setTimeout(() => setWalk({
      keyframes: stops.map(x => `translateX(${x}px)`),
      times: stops.map((_, i) => i / (stops.length - 1)),
      seconds: (distance * laps * 2) / 150,
    }), 0)
    return () => clearTimeout(t)
  }, [id, enabled, onEnd])
  return walk
}
