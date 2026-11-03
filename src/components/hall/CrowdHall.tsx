'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell, DeviceMobile } from '@phosphor-icons/react/dist/ssr'
import { motion, useReducedMotion } from 'framer-motion'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { cn } from '@/lib/utils/cn'
import type { ActivityLevel } from '@/lib/people'

export interface CrowdItem {
  key: string
  level: ActivityLevel
  /** Avatar seed. Null draws a small unnamed dot (the public hall's quiet members). */
  seed: string | null
  /** Shown under the bigger avatars, and in the tooltip. */
  name: string | null
  label: string
  selected?: boolean
  you?: boolean
  app?: boolean
  push?: boolean
  onClick?: () => void
}

const SIZE: Record<ActivityLevel, number> = { driving: 84, regular: 60, showing_up: 44, quiet: 30 }
const RANK: Record<ActivityLevel, number> = { driving: 0, regular: 1, showing_up: 2, quiet: 3 }
const GOLDEN = Math.PI * (3 - Math.sqrt(5))
/** Breathing room between neighbours. */
const GAP = 10
/** Extra room under avatars that carry a name. */
const LABEL = 18

function named(item: CrowdItem): boolean {
  return !!item.name && (item.level === 'driving' || item.level === 'regular' || !!item.you)
}

/** Small stable jitter from a key, so the crowd looks scattered but never moves between renders. */
function jitter(key: string): number {
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0
  return ((Math.abs(h) % 1000) / 1000) * 0.6
}

/**
 * Seeded on a sunflower spiral (most involved first, so they start in the
 * middle), then settled: overlapping neighbours push apart while a gentle
 * pull keeps the group round. Deterministic, so the crowd is the same every
 * time it's drawn, and cheap at guild sizes (a few hundred people at most).
 */
function layout(items: CrowdItem[], dotQuiet: boolean) {
  const sorted = [...items].sort((a, b) => RANK[a.level] - RANK[b.level])
  let area = 0
  const nodes = sorted.map((item, i) => {
    const size = item.seed || !dotQuiet ? SIZE[item.level] : 12
    const r = size / 2 + GAP / 2 + (named(item) ? LABEL / 2 : 0)
    area += Math.PI * r * r
    const dist = i === 0 ? 0 : Math.sqrt(area / Math.PI)
    const a = i * GOLDEN + jitter(item.key)
    return { item, size, r, x: dist * Math.cos(a), y: dist * Math.sin(a) }
  })

  for (let iter = 0; iter < 140; iter++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const p = nodes[i], q = nodes[j]
        let dx = q.x - p.x, dy = q.y - p.y
        let d = Math.hypot(dx, dy)
        if (d < 0.01) { dx = 0.01 * (j - i); dy = 0.01; d = Math.hypot(dx, dy) }
        const overlap = p.r + q.r - d
        if (overlap > 0) {
          // The smaller one gives way more, so big avatars stay put in the middle.
          const total = p.r + q.r
          const ux = dx / d, uy = dy / d
          p.x -= ux * overlap * (q.r / total)
          p.y -= uy * overlap * (q.r / total)
          q.x += ux * overlap * (p.r / total)
          q.y += uy * overlap * (p.r / total)
        }
      }
    }
    for (const n of nodes) { n.x *= 0.985; n.y *= 0.985 }
  }

  const cx = nodes.reduce((s, n) => s + n.x, 0) / Math.max(nodes.length, 1)
  const cy = nodes.reduce((s, n) => s + n.y, 0) / Math.max(nodes.length, 1)
  // Rounded: server and browser print long floats differently (hydration).
  return nodes.map(n => ({ item: n.item, size: n.size, x: Math.round((n.x - cx) * 10) / 10, y: Math.round((n.y - cy) * 10) / 10 }))
}

/**
 * The guild as a crowd: everyone gathered in one loose circle, the most
 * involved biggest and in the middle, getting smaller towards the edge. Used
 * by the admin People tab (everyone named, pickable) and the public guild
 * hall (quiet members as unnamed dots).
 */
export function CrowdHall({ items, dotQuiet = false }: { items: CrowdItem[]; dotQuiet?: boolean }) {
  const reduce = useReducedMotion()
  const placed = layout(items, dotQuiet)
  const extent = placed.reduce((m, p) => Math.max(m, Math.abs(p.x) + p.size / 2, Math.abs(p.y) + p.size / 2 + LABEL), 60)
  const stage = Math.ceil(extent * 2 + 24)

  // Shrinks to fit a narrow screen instead of scrolling sideways.
  const outer = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState<number | null>(null)
  useEffect(() => {
    const el = outer.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const scale = width ? Math.min(1, width / stage) : 1

  return (
    <div ref={outer} className="w-full" style={{ height: stage * scale }}>
      <div className="relative mx-auto origin-top" style={{ width: stage, height: stage, transform: scale < 1 ? `scale(${scale})` : undefined, marginLeft: scale < 1 ? 0 : undefined }}>
        <ul>
          {placed.map(({ item, size, x, y }, i) => {
            const showName = named(item)
            const Tag = item.onClick ? 'button' : 'span'
            return (
              <motion.li
                key={item.key}
                className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center"
                style={{ left: stage / 2 + x, top: stage / 2 + y }}
                initial={reduce ? false : { opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: reduce ? 0 : Math.min(i * 0.012, 0.5), type: 'spring', bounce: 0.35, duration: 0.5 }}
              >
                <Tag
                  {...(item.onClick ? { type: 'button' as const, onClick: item.onClick, 'aria-pressed': !!item.selected } : {})}
                  aria-label={item.label}
                  title={item.label}
                  className={cn(
                    'relative grid place-items-center rounded-full transition-transform',
                    item.onClick && 'hover:z-10 hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink',
                    item.selected && 'ring-2 ring-ink ring-offset-2 ring-offset-parchment',
                    item.you && !item.selected && 'ring-2 ring-ink/50 ring-offset-2 ring-offset-parchment',
                  )}
                >
                  {item.seed ? (
                    <span className={cn('block rounded-full', item.level === 'quiet' && 'opacity-50 grayscale')}>
                      <UserAvatar username={item.seed} size={size} />
                    </span>
                  ) : (
                    <span className="block rounded-full bg-border-strong" style={{ width: size, height: size }} />
                  )}
                  {(item.app || item.push) && (
                    <span aria-hidden className="absolute -bottom-1.5 left-1/2 flex -translate-x-1/2 gap-0.5 rounded-full border border-border bg-paper px-1 py-px text-ink-muted">
                      {item.app && <DeviceMobile className="size-2.5" weight="bold" />}
                      {item.push && <Bell className="size-2.5" weight="bold" />}
                    </span>
                  )}
                </Tag>
                {showName && (
                  <span className="mt-1 max-w-[96px] truncate text-[11px] leading-tight text-ink-soft">{item.you ? 'you' : item.name}</span>
                )}
              </motion.li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
