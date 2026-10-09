'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils/cn'
import { useToast } from '@/hooks/useToast'

/**
 * Let GuildBot tease you by name. Off by default. The bot only does it in
 * comments on your own posts and replies in the app, never in Slack, never
 * on a post you made as a ghost, and never about work or pay.
 */
export function RoastMeToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial)
  const [pending, setPending] = useState(false)
  const toast = useToast()

  const flip = async () => {
    if (pending) return
    const next = !on
    setOn(next)
    setPending(true)
    try {
      const res = await fetch('/api/profile/roast-me', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roast_me: next }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setOn(!next)
      toast('Could not save that. Try again.', 'error')
    } finally {
      setPending(false)
    }
  }

  return (
    <label className="flex items-start gap-3 cursor-pointer select-none mb-8">
      <button
        type="button"
        role="switch"
        aria-checked={on}
        onClick={flip}
        disabled={pending}
        className={cn('relative mt-0.5 shrink-0 w-8 h-4.5 rounded-full transition-colors', on ? 'bg-ink' : 'bg-border-strong')}
      >
        <span className={cn('absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-paper transition-transform', on && 'translate-x-3.5')} />
        <span className="sr-only">Let GuildBot tease me by name</span>
      </button>
      <span className="min-w-0">
        <span className="block text-[13px] text-ink">Let GuildBot tease me by name</span>
        <span className="block text-[12px] text-cha mt-0.5 leading-relaxed">
          Only on your own posts and replies in the app. Never in Slack, never on a ghost post, never about work.
        </span>
      </span>
    </label>
  )
}
