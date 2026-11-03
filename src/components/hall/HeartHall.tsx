'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Bell, DeviceMobile, MicrophoneStage } from '@phosphor-icons/react/dist/ssr'
import { motion, useReducedMotion } from 'framer-motion'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { cn } from '@/lib/utils/cn'
import type { ActivityLevel } from '@/lib/people'

export interface HeartItem {
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
const FILL: Record<ActivityLevel, number> = { driving: 0.96, regular: 0.86, showing_up: 0.76, quiet: 0.64 }

/* The heart, in unit space with y up: (x² + y² − 1)³ − x²y³ ≤ 0. It spans
   roughly x ∈ [−1.14, 1.14], y ∈ [−1, 1.23]. */
const X0 = -1.16, X1 = 1.16, Y0 = -1.02, Y1 = 1.26
const CENTRE = { x: 0, y: 0.18 }

function inHeart(x: number, y: number): boolean {
  const a = x * x + y * y - 1
  return a * a * a - x * x * y * y * y <= 0
}

/** The heart's outline as a polygon, found by walking out from inside it. */
function outline(steps = 160): { x: number; y: number }[] {
  const o = { x: 0, y: 0.1 }
  const pts: { x: number; y: number }[] = []
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2
    let lo = 0, hi = 2
    for (let k = 0; k < 30; k++) {
      const mid = (lo + hi) / 2
      if (inHeart(o.x + mid * Math.cos(t), o.y + mid * Math.sin(t))) lo = mid
      else hi = mid
    }
    pts.push({ x: o.x + lo * Math.cos(t), y: o.y + lo * Math.sin(t) })
  }
  return pts
}
const OUTLINE = outline()

/** Hex-grid points inside the heart at spacing s, nearest the centre first. */
/** Avatars sit inside a slightly smaller heart, so the drawn outline frames them. */
const INSET = 0.86

function cells(s: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = []
  const dy = s * Math.sqrt(3) / 2
  let row = 0
  for (let y = Y0; y <= Y1; y += dy, row++) {
    for (let x = X0 + (row % 2 ? s / 2 : 0); x <= X1; x += s) {
      if (inHeart(x / INSET, (y - CENTRE.y) / INSET + CENTRE.y)) out.push({ x, y })
    }
  }
  return out.sort((a, b) => Math.hypot(a.x - CENTRE.x, a.y - CENTRE.y) - Math.hypot(b.x - CENTRE.x, b.y - CENTRE.y))
}

/** The widest spacing that still fits everyone: the heart is always full. */
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
 * The guild as a heart: every member an avatar in one honeycomb shaped like
 * a heart, the most involved in the middle. The grid resizes to the head
 * count, so the heart keeps its shape as people join or leave; spare cells
 * are faint dots that hold the outline. Used by the admin People tab and the
 * public guild hall.
 */
export function HeartHall({ items }: { items: HeartItem[] }) {
  const reduce = useReducedMotion()
  const outer = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(640)
  useEffect(() => {
    const el = outer.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.min(720, e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const sorted = useMemo(() => [...items].sort((a, b) => RANK[a.level] - RANK[b.level]), [items])
  const { s, points } = useMemo(() => fit(Math.max(sorted.length, 1)), [sorted.length])

  const unit = width / (X1 - X0)
  const height = Math.round((Y1 - Y0) * unit)
  const cell = s * unit
  const toPx = (p: { x: number; y: number }) => ({
    left: Math.round((p.x - X0) * unit * 10) / 10,
    top: Math.round((Y1 - p.y) * unit * 10) / 10,
  })

  return (
    <div ref={outer} className="w-full">
      <ul className="relative mx-auto" style={{ width, height }} aria-label={`${items.length} members`}>
        {/* The heart itself, faint, so the shape reads at any head count. */}
        <svg aria-hidden className="pointer-events-none absolute inset-0 overflow-visible" width={width} height={height}>
          <path
            d={OUTLINE.map((p, i) => {
              const { left, top } = toPx(p)
              return `${i ? 'L' : 'M'}${left},${top}`
            }).join(' ') + ' Z'}
            className="fill-kinu/40 stroke-border"
            strokeWidth={1}
          />
        </svg>
        {points.slice(sorted.length).map((p, i) => (
          <li key={`spare-${i}`} aria-hidden className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full bg-border" style={{ ...toPx(p), width: Math.max(4, cell * 0.16), height: Math.max(4, cell * 0.16) }} />
        ))}
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
