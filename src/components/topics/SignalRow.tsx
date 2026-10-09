'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Eyes, HandWaving, Question, SmileyWink, Wrench } from '@phosphor-icons/react/dist/ssr'
import type { Icon as PhosphorIcon } from '@phosphor-icons/react'
import { SIGNAL_KINDS, SIGNAL_LABELS, type SignalKind } from '@/lib/constants'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/utils/cn'
import { useToast } from '@/hooks/useToast'
import { useGuestGate } from '@/components/auth/GuestGate'

/**
 * Duotone, so each glyph carries two tones of its own hue rather than needing a
 * hand-drawn second layer. This is the reason the icon set moved to Phosphor:
 * emoji could not inherit colour, could not take a weight, and rendered as a
 * different picture on every operating system.
 */
const SIGNAL_ICONS: Record<SignalKind, PhosphorIcon> = {
  curious: Eyes,
  would_attend: HandWaving,
  explain_more: Question,
  done_this: Wrench,
}

interface SignalRowProps {
  topicId: string
  /** Compact styling for the board list; full labels on the detail page. */
  compact?: boolean
  /**
   * Counts already fetched by the parent. The board ships these inline with
   * /api/topics so a list of cards does not fire one request each; omit them
   * and the row fetches its own.
   */
  initialCounts?: Record<string, number>
  initialMine?: string[]
  /** Fresh tallies from a live broadcast. Applied whenever a new object arrives. */
  liveCounts?: Record<string, number>
}

/**
 * One-tap responses to a topic. No writing, no quota, no cycle gate - this
 * stays usable when voting and commenting are locked, which is most of the
 * month. There is no negative signal by design.
 */
export function SignalRow({ topicId, compact = false, initialCounts, initialMine, liveCounts }: SignalRowProps) {
  const hasInitial = initialCounts !== undefined
  const [counts, setCounts] = useState<Record<string, number>>(initialCounts ?? {})
  const [mine, setMine] = useState<Set<SignalKind>>(new Set((initialMine ?? []) as SignalKind[]))
  const [pending, setPending] = useState<SignalKind | null>(null)
  const [loaded, setLoaded] = useState(hasInitial)
  const toast = useToast()
  const { blockGuest } = useGuestGate()

  // Live tallies replace ours when they change, except mid-tap, when the
  // optimistic count is about to be confirmed by the next broadcast anyway.
  const [seenLive, setSeenLive] = useState(liveCounts)
  if (liveCounts !== seenLive) {
    setSeenLive(liveCounts)
    if (liveCounts && !pending) setCounts(liveCounts)
  }

  useEffect(() => {
    if (hasInitial) return
    let cancelled = false
    fetch(`/api/topic-signals?topic_id=${topicId}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        setCounts(data.counts ?? {})
        setMine(new Set(data.mine ?? []))
        setLoaded(true)
      })
      .catch(() => { if (!cancelled) setLoaded(true) })
    return () => { cancelled = true }
  }, [topicId, hasInitial])

  const toggle = async (signal: SignalKind) => {
    if (pending) return
    if (blockGuest()) return
    setPending(signal)

    // Optimistic - a one-tap affordance must feel instant.
    const wasActive = mine.has(signal)
    setMine(prev => {
      const next = new Set(prev)
      if (wasActive) next.delete(signal); else next.add(signal)
      return next
    })
    setCounts(prev => ({ ...prev, [signal]: Math.max((prev[signal] ?? 0) + (wasActive ? -1 : 1), 0) }))

    try {
      const res = await fetch('/api/topic-signals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_id: topicId, signal }),
      })
      if (!res.ok) throw new Error('failed')
    } catch {
      // Roll back.
      setMine(prev => {
        const next = new Set(prev)
        if (wasActive) next.add(signal); else next.delete(signal)
        return next
      })
      setCounts(prev => ({ ...prev, [signal]: Math.max((prev[signal] ?? 0) + (wasActive ? 1 : -1), 0) }))
      toast('Could not save that reaction. Try again.', 'error')
    } finally {
      setPending(null)
    }
  }

  if (!loaded) return null

  return (
    <ReactionPicker
      counts={counts}
      mine={mine}
      pending={pending}
      compact={compact}
      onToggle={toggle}
    />
  )
}

/* ─── The picker ────────────────────────────────────────────
   One trigger instead of four buttons, like a social reaction bar. At rest it
   shows what the room already said: up to three stacked reaction discs and a
   total. Hover (on a pointer) or tap opens a small tray of all four; tapping
   one toggles it, and you can hold more than one.
   Buttons inside a card link, so every handler stops the click from
   navigating. */

/* Solid for the small stacked discs (the "what the room said" summary, same
   as the landing wall); tinted in the tray, filling to solid on hover. */
/* Every class written out in full: Tailwind finds classes by scanning source
   text, so a `hover:${...}` built at runtime would never be generated. */
const TONE: Record<SignalKind, { solid: string; tray: string }> = {
  curious: { solid: 'bg-indigo-jp', tray: 'bg-indigo-light text-indigo-jp hover:bg-indigo-jp hover:text-white' },
  would_attend: { solid: 'bg-matcha', tray: 'bg-matcha-light text-matcha hover:bg-matcha hover:text-white' },
  explain_more: { solid: 'bg-wisteria', tray: 'bg-wisteria-light text-wisteria hover:bg-wisteria hover:text-white' },
  done_this: { solid: 'bg-saffron', tray: 'bg-saffron-light text-saffron hover:bg-saffron hover:text-white' },
}

function Disc({ signal }: { signal: SignalKind }) {
  // The glyph directly rather than through <Icon>: the disc needs an 11px
  // glyph, below the icon scale's floor.
  const Glyph = SIGNAL_ICONS[signal]
  return (
    <span className={cn('inline-flex items-center justify-center w-5 h-5 rounded-full text-white ring-2 ring-paper', TONE[signal].solid)}>
      <Glyph size={11} weight="fill" aria-hidden />
    </span>
  )
}

function ReactionPicker({
  counts,
  mine,
  pending,
  compact,
  onToggle,
}: {
  counts: Record<string, number>
  mine: Set<SignalKind>
  pending: SignalKind | null
  compact: boolean
  onToggle: (signal: SignalKind) => void
}) {
  const reduce = useReducedMotion()
  const [open, setOpen] = useState(false)
  // One label for the whole tray, naming whichever reaction is under the
  // pointer or focus. Four permanent labels crowded the tray and overlapped.
  const [hovered, setHovered] = useState<SignalKind | null>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const openTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const present = SIGNAL_KINDS.filter(s => (counts[s] ?? 0) > 0)
  const total = present.reduce((n, s) => n + (counts[s] ?? 0), 0)
  const myFirst = SIGNAL_KINDS.find(s => mine.has(s))

  // Close on outside tap and on Escape. Listeners exist only while open.
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  useEffect(() => () => { clearTimeout(closeTimer.current); clearTimeout(openTimer.current) }, [])

  // Hover opens only where hover exists; on touch the tap does it.
  const onEnter = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    clearTimeout(closeTimer.current)
    openTimer.current = setTimeout(() => setOpen(true), 250)
  }
  const onLeave = (e: React.PointerEvent) => {
    if (e.pointerType !== 'mouse') return
    clearTimeout(openTimer.current)
    closeTimer.current = setTimeout(() => { setOpen(false); setHovered(null) }, 300)
  }
  const stop = (e: React.SyntheticEvent) => { e.preventDefault(); e.stopPropagation() }

  return (
    <div ref={rootRef} className="relative inline-flex" onPointerEnter={onEnter} onPointerLeave={onLeave}>
      <button
        type="button"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label={total ? `Reactions: ${total}. React` : 'React'}
        onClick={e => { stop(e); setOpen(o => !o) }}
        className={cn(
          'press inline-flex items-center gap-1.5 rounded-full transition-colors outline-none',
          'focus-visible:ring-2 focus-visible:ring-saffron/40',
          compact ? 'h-8 px-2 pointer-coarse:h-10' : 'h-9 px-3 border border-border',
          open ? 'bg-kinu/70 text-ink' : myFirst ? 'text-ink hover:bg-kinu/50' : 'text-cha hover:text-ink hover:bg-kinu/50',
        )}
      >
        {present.length > 0 ? (
          <span className="flex -space-x-1.5">
            {present.slice(0, 3).map(s => <Disc key={s} signal={s} />)}
          </span>
        ) : (
          <Icon icon={SmileyWink} size="md" />
        )}
        {/* On a card there is no room for a label: discs and a number, or
            nothing but the icon until someone reacts. The detail page has the
            width, so it names your reaction. */}
        {compact ? (
          total > 0 && <span className="text-[13px] font-medium tabular-nums">{total}</span>
        ) : (
          <span className="text-[13px] font-medium tabular-nums">
            {myFirst ? SIGNAL_LABELS[myFirst] : total > 0 ? total : 'React'}
            {myFirst && total > 1 && <span className="text-cha font-normal"> · {total}</span>}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            aria-label="Pick a reaction"
            onClick={stop}
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4, scale: 0.96 }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 2, scale: 0.98 }}
            transition={{ type: 'spring', bounce: 0.15, duration: 0.25 }}
            className="absolute bottom-full left-0 mb-2 z-(--z-overlay) origin-bottom-left"
          >
            {/* The one label, above the tray. Reserved height so the tray
                never jumps when it appears. */}
            <div className="h-7 flex items-end justify-center">
              {hovered && (
                <span className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-medium text-parchment whitespace-nowrap">
                  {SIGNAL_LABELS[hovered]}
                  {(counts[hovered] ?? 0) > 0 && <span className="opacity-60"> · {counts[hovered]}</span>}
                </span>
              )}
            </div>
            <div className="mt-1.5 flex items-center gap-0.5 p-1 rounded-full border border-border bg-paper shadow-[0_8px_24px_-10px_var(--shadow-tint-strong)]">
              {SIGNAL_KINDS.map(s => {
                const active = mine.has(s)
                const Glyph = SIGNAL_ICONS[s]
                const tone = TONE[s]
                return (
                  <motion.button
                    key={s}
                    type="button"
                    role="menuitemcheckbox"
                    aria-checked={active}
                    aria-label={SIGNAL_LABELS[s]}
                    disabled={pending !== null}
                    onClick={e => { stop(e); onToggle(s) }}
                    onPointerEnter={() => setHovered(s)}
                    onFocus={() => setHovered(s)}
                    whileHover={reduce ? undefined : { y: -2, scale: 1.1 }}
                    whileTap={reduce ? undefined : { scale: 0.92 }}
                    transition={{ type: 'spring', bounce: 0.35, duration: 0.25 }}
                    className={cn(
                      'relative inline-flex items-center justify-center w-9 h-9 rounded-full transition-colors outline-none disabled:opacity-60',
                      'focus-visible:ring-2 focus-visible:ring-saffron/40',
                      active ? cn(tone.solid, 'text-white') : tone.tray,
                    )}
                  >
                    <Glyph size={18} weight="fill" aria-hidden />
                  </motion.button>
                )
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
