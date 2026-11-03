'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, DeviceMobile, MicrophoneStage } from '@phosphor-icons/react/dist/ssr'
import { motion, useReducedMotion } from 'framer-motion'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { cn } from '@/lib/utils/cn'
import type { ActivityLevel } from '@/lib/people'

export interface CircleItem {
  key: string
  level: ActivityLevel
  seed: string
  /** Shown on hover and focus. */
  name: string
  label: string
  selected?: boolean
  you?: boolean
  /** Joined in the last two weeks: ringed in Kers' mint. */
  isNew?: boolean
  /** On for Show & Tell this month. */
  presenting?: boolean
  app?: boolean
  push?: boolean
  onClick?: () => void
}

const RANK: Record<ActivityLevel, number> = { driving: 0, regular: 1, showing_up: 2, quiet: 3 }
/** Avatar size as a share of its cell: the more involved, the fuller. */
const FILL: Record<ActivityLevel, number> = { driving: 0.92, regular: 0.8, showing_up: 0.7, quiet: 0.58 }

/** The circle's widest; it shrinks to fit narrower screens. */
const MAX_W = 480

/* A disc in unit space. */
const X0 = -1, X1 = 1, Y0 = -1, Y1 = 1
const CENTRE = { x: 0, y: 0 }

/** Hex-grid points inside the disc at spacing s, nearest the centre first. */
function cells(s: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = []
  const dy = s * Math.sqrt(3) / 2
  let row = 0
  for (let y = Y0; y <= Y1; y += dy, row++) {
    for (let x = X0 + (row % 2 ? s / 2 : 0); x <= X1; x += s) {
      if (x * x + y * y <= 1) out.push({ x, y })
    }
  }
  return out.sort((a, b) => Math.hypot(a.x - CENTRE.x, a.y - CENTRE.y) - Math.hypot(b.x - CENTRE.x, b.y - CENTRE.y))
}

/** The widest spacing that still fits everyone, so the circle is always full. */
function fit(n: number) {
  let lo = 0.02, hi = 1.2
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2
    if (cells(mid).length >= n) lo = mid
    else hi = mid
  }
  return { s: lo, points: cells(lo) }
}

/**
 * The guild as one round group: every member an avatar in a honeycomb, the
 * most involved in the middle and largest, quieter members further out. The
 * grid resizes to the head count and fills from the centre, so the group
 * stays round as people join or leave. Used by the admin People tab and the
 * public guild hall.
 */
export function CircleHall({ items }: { items: CircleItem[] }) {
  const reduce = useReducedMotion()
  const outer = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(MAX_W)
  useEffect(() => {
    const el = outer.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.min(MAX_W, e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const sorted = useMemo(() => [...items].sort((a, b) => RANK[a.level] - RANK[b.level]), [items])
  const { s, points } = useMemo(() => fit(Math.max(sorted.length, 1)), [sorted.length])

  const unit = width / (X1 - X0)
  const cell = s * unit
  // Only as tall as the cells in use (the grid fills from the centre, so a
  // part-full disc would otherwise leave an empty band top and bottom).
  const used = points.slice(0, sorted.length)
  const yTop = used.reduce((m, p) => Math.max(m, p.y), -Infinity)
  const yBottom = used.reduce((m, p) => Math.min(m, p.y), Infinity)
  const height = Math.round((yTop - yBottom) * unit + cell)
  const toPx = (p: { x: number; y: number }) => ({
    left: Math.round((p.x - X0) * unit * 10) / 10,
    top: Math.round(((yTop - p.y) * unit + cell / 2) * 10) / 10,
  })

  return (
    <div ref={outer} className="w-full py-8">
      <ul className="relative mx-auto" style={{ width, height }} aria-label={`${items.length} members`}>
        {sorted.map((item, i) => {
          const size = Math.max(14, Math.round(cell * FILL[item.level]))
          const Tag = item.onClick ? 'button' : 'span'
          return (
            <motion.li
              key={item.key}
              className="group absolute -translate-x-1/2 -translate-y-1/2 hover:z-20 focus-within:z-20"
              style={toPx(points[i])}
              initial={reduce ? false : { opacity: 0, scale: 0.4 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: reduce ? 0 : Math.min(i * 0.01, 0.45), type: 'spring', bounce: 0.35, duration: 0.45 }}
            >
              <Tag
                {...(item.onClick ? { type: 'button' as const, onClick: item.onClick, 'aria-pressed': !!item.selected } : {})}
                aria-label={item.label}
                className={cn(
                  'relative grid place-items-center rounded-full transition-transform',
                  item.onClick && 'hover:scale-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink',
                  item.isNew && 'ring-2 ring-[#3DB88A] ring-offset-2 ring-offset-parchment',
                  item.you && 'ring-2 ring-ink/60 ring-offset-2 ring-offset-parchment',
                  item.selected && 'ring-2 ring-ink ring-offset-2 ring-offset-parchment',
                )}
              >
                <span className={cn('block rounded-full', item.level === 'quiet' && 'opacity-60 saturate-50')}>
                  <UserAvatar username={item.seed} size={size} />
                </span>
                {item.isNew && <span aria-hidden className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-parchment bg-[#3DB88A]" />}
                {item.presenting && (
                  <span aria-hidden className="absolute -bottom-1 -right-1 grid size-5 place-items-center rounded-full bg-ink text-parchment shadow-sm">
                    <MicrophoneStage className="size-3" weight="fill" />
                  </span>
                )}
                {(item.app || item.push) && (
                  <span aria-hidden className="absolute -bottom-1.5 left-1/2 flex -translate-x-1/2 gap-0.5 rounded-full border border-border bg-paper px-1 py-px text-ink-muted">
                    {item.app && <DeviceMobile className="size-2.5" weight="bold" />}
                    {item.push && <Bell className="size-2.5" weight="bold" />}
                  </span>
                )}
              </Tag>
              {/* The name, on hover or keyboard focus. */}
              <span className="pointer-events-none absolute bottom-full left-1/2 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-(--radius-control) bg-ink px-2 py-1 text-caption text-parchment shadow-sm group-hover:block group-focus-within:block">
                {item.you ? `${item.name} (you)` : item.name}{item.isNew ? ' · new' : ''}
              </span>
            </motion.li>
          )
        })}
      </ul>
    </div>
  )
}
