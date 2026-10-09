'use client'

import { useEffect, useRef, useState } from 'react'
import { botSays, BOT_MARK } from '@/lib/guildbot-host/voice'

const SEQUENCE = ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'b', 'a']

/**
 * Up, up, down, down, left, right, left, right, B, A: GuildBot notices.
 * Ignored while typing in a field, so it can never get in the way. The note
 * closes itself after a few seconds, or on click or Escape.
 */
export function KonamiEgg() {
  const [text, setText] = useState<string | null>(null)
  const progress = useRef(0)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setText(null); return }
      const el = e.target as HTMLElement | null
      if (el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return

      const key = e.key.length === 1 ? e.key.toLowerCase() : e.key
      progress.current = key === SEQUENCE[progress.current] ? progress.current + 1 : key === SEQUENCE[0] ? 1 : 0
      if (progress.current === SEQUENCE.length) {
        progress.current = 0
        setText(botSays('egg.konami', String(Date.now()), 'ui'))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (!text) return
    const t = setTimeout(() => setText(null), 6000)
    return () => clearTimeout(t)
  }, [text])

  if (!text) return null
  return (
    <button
      type="button"
      onClick={() => setText(null)}
      role="status"
      className="fixed inset-x-4 top-20 z-50 mx-auto max-w-sm flex items-start gap-2.5 rounded-(--radius-card) border border-saffron/40 bg-paper p-4 text-left shadow-2xl animate-fade-up"
    >
      <span aria-hidden className="text-saffron text-lg leading-none">{BOT_MARK}</span>
      <span className="text-[13px] leading-relaxed text-ink">{text}</span>
    </button>
  )
}
