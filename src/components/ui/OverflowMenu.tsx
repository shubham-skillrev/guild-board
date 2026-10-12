'use client'

import { useEffect, useRef, useState } from 'react'
import { DotsThree } from '@phosphor-icons/react/dist/ssr'
import { cn } from '@/lib/utils/cn'

export interface OverflowItem {
  label: string
  onSelect: () => void
  /** Destructive: shown in red, after a divider, at the bottom. */
  danger?: boolean
  disabled?: boolean
}

/**
 * The "⋯" button: where rare and destructive actions live, so a row shows only
 * what you do often. Danger items always sit last, under a divider, so Delete
 * is never the first thing under your cursor.
 */
export function OverflowMenu({ items, label = 'More actions', className }: { items: OverflowItem[]; label?: string; className?: string }) {
  const [open, setOpen] = useState(false)
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent | TouchEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false) }
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('touchstart', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('touchstart', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  const safe = items.filter(i => !i.danger)
  const danger = items.filter(i => i.danger)

  const row = (item: OverflowItem) => (
    <button
      key={item.label}
      type="button"
      role="menuitem"
      disabled={item.disabled}
      onClick={() => { setOpen(false); item.onSelect() }}
      className={cn(
        'flex w-full items-center px-3 h-9 text-left text-footnote transition-colors disabled:opacity-40',
        item.danger ? 'text-vermillion hover:bg-vermillion/10' : 'text-ink-soft hover:bg-kinu/60 hover:text-ink',
      )}
    >
      {item.label}
    </button>
  )

  return (
    <div ref={wrap} className={cn('relative', className)}>
      <button
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(o => !o)}
        className="press inline-flex items-center justify-center w-8 h-8 rounded-full text-ink-muted hover:text-ink hover:bg-kinu/60 pointer-coarse:w-10 pointer-coarse:h-10"
      >
        <DotsThree className="w-4 h-4" weight="bold" />
      </button>
      {open && (
        <div role="menu" className="absolute right-0 z-(--z-chrome) mt-1 min-w-44 py-1 rounded-(--radius-card) border border-border bg-paper shadow-lg">
          {safe.map(row)}
          {safe.length > 0 && danger.length > 0 && <div className="my-1 border-t border-border" />}
          {danger.map(row)}
        </div>
      )}
    </div>
  )
}
