'use client'

import { ChartBar, Check } from '@phosphor-icons/react/dist/ssr'
import { useState } from 'react'
import { cn } from '@/lib/utils/cn'
import { useToast } from '@/hooks/useToast'
import { useGuestGate } from '@/components/auth/GuestGate'
import type { TopicPoll } from '@/types'

/**
 * A topic's poll. Before you vote you see the options and how many have voted,
 * not how they voted, so early votes are your own and not the crowd's. After
 * voting, or once voting closes, the bars appear. Tapping another option moves
 * your vote while voting is open. Nobody, admins included, can see who chose what.
 */
export function PollCard({ poll, onChange }: { poll: TopicPoll; onChange: (next: TopicPoll) => void }) {
  const [pending, setPending] = useState<string | null>(null)
  const toast = useToast()
  const { blockGuest } = useGuestGate()

  const send = async (method: 'POST' | 'DELETE', optionId?: string) => {
    if (blockGuest() || pending) return
    setPending(optionId ?? 'retract')
    try {
      const res = await fetch('/api/polls/vote', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(method === 'POST' ? { poll_id: poll.id, option_id: optionId } : { poll_id: poll.id }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data) {
        toast(data?.error ?? 'Vote failed, try again', 'error')
        return
      }
      onChange(data as TopicPoll)
    } catch {
      toast('Vote failed, check your connection', 'error')
    } finally {
      setPending(null)
    }
  }

  const total = poll.total_votes
  const leading = poll.results_visible
    ? Math.max(0, ...poll.options.map(o => o.votes ?? 0))
    : 0

  return (
    <section aria-label="Poll" className="rounded-(--radius-card) border border-border bg-paper p-(--pad-card)">
      <p className="flex items-center gap-2 text-[11px] font-semibold text-cha uppercase tracking-wider">
        <ChartBar className="w-3.5 h-3.5" />
        Poll
      </p>
      <h3 className="mt-1.5 text-[15px] font-semibold leading-snug text-ink">{poll.question}</h3>

      <ul className="mt-3 space-y-2">
        {poll.options.map(option => {
          const mine = poll.my_option_id === option.id
          const votes = option.votes ?? 0
          const pct = total > 0 ? Math.round((votes / total) * 100) : 0
          const isLeading = poll.results_visible && votes > 0 && votes === leading

          return (
            <li key={option.id}>
              <button
                type="button"
                onClick={() => !mine && send('POST', option.id)}
                disabled={!poll.voting_open || !!pending}
                aria-pressed={mine}
                className={cn(
                  'press relative w-full overflow-hidden rounded-(--radius-control) border text-left text-[14px] transition-colors',
                  'disabled:cursor-default',
                  mine ? 'border-saffron/50' : 'border-border',
                  poll.voting_open && !mine && 'hover:border-border-strong',
                  pending === option.id && 'opacity-60',
                )}
              >
                {/* The bar sits behind the text and only exists once results show. */}
                {poll.results_visible && (
                  <span
                    aria-hidden
                    style={{ width: `${pct}%` }}
                    className={cn(
                      'absolute inset-y-0 left-0 transition-[width] duration-500',
                      mine ? 'bg-saffron-light' : isLeading ? 'bg-kinu' : 'bg-sumi',
                    )}
                  />
                )}
                <span className="relative flex items-center gap-2 px-3 py-2.5">
                  {mine && <Check className="w-3.5 h-3.5 shrink-0 text-saffron" weight="bold" />}
                  <span className={cn('min-w-0 flex-1', mine ? 'text-ink font-medium' : 'text-ink-soft')}>{option.label}</span>
                  {poll.results_visible && (
                    <span className="shrink-0 text-[12px] tabular-nums text-cha">{pct}%</span>
                  )}
                </span>
              </button>
            </li>
          )
        })}
      </ul>

      <p className="mt-3 flex items-center gap-3 text-[12px] text-cha">
        <span className="tabular-nums">{total} {total === 1 ? 'vote' : 'votes'}</span>
        {!poll.results_visible && poll.voting_open && <span>Vote to see results</span>}
        {!poll.voting_open && <span>Voting closed</span>}
        {poll.my_option_id && poll.voting_open && (
          <button
            type="button"
            onClick={() => send('DELETE')}
            disabled={!!pending}
            className="ml-auto text-cha hover:text-ink transition-colors"
          >
            Take back my vote
          </button>
        )}
      </p>
    </section>
  )
}
