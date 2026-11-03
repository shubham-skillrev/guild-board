'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Check } from '@phosphor-icons/react/dist/ssr'
import { Kers } from '@/components/kers/Kers'
import { PushToggleButton } from '@/components/pwa/PushOptIn'
import { cn } from '@/lib/utils/cn'
import type { Onboarding, OnboardingStep } from '@/lib/onboarding'

const HIDE_KEY = 'gb-onboarding-hidden'

const STEPS: { key: OnboardingStep; title: string; hint: string; href?: string; cta?: string }[] = [
  { key: 'survey', title: 'Answer the two-minute survey', hint: 'Tell us what would make the meeting worth your hour.', href: '/survey', cta: 'Answer' },
  { key: 'vote', title: 'Vote on a topic', hint: 'Votes decide what the meeting talks about.', href: '#board-topics', cta: 'See topics' },
  { key: 'speak', title: 'Say something', hint: 'A comment on a topic counts. So does posting your own.', href: '#board-topics', cta: 'Pick one' },
  { key: 'notifications', title: 'Turn on notifications', hint: 'Replies, the meeting reminder, and when you get a spark.' },
  { key: 'app', title: 'Add GuildBoard to your home screen', hint: 'Your browser’s “Install” or “Add to Home Screen”. Opens like an app.' },
]

/**
 * A new member's first two weeks: Kers' getting-started list on the board.
 * Each step ticks itself off from what they actually did, and the card goes
 * away when everything's done, after two weeks, or when they hide it.
 */
export function GettingStarted({ onDone }: { onDone?: () => void } = {}) {
  const [data, setData] = useState<Onboarding | null>(null)
  const [hidden, setHidden] = useState(true)

  useEffect(() => {
    let alive = true
    let dismissed = false
    try { dismissed = localStorage.getItem(HIDE_KEY) === '1' } catch {}
    if (dismissed) return
    fetch('/api/me/onboarding', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then((d: Onboarding | null) => {
        if (!alive || !d?.show) return
        setData(d)
        setHidden(false)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  if (hidden || !data) return null
  const doneCount = STEPS.filter(s => data.done[s.key]).length

  return (
    <section aria-labelledby="getting-started" className="elev-2 rounded-(--radius-card) p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <Kers size={64} expression="excited" colour="proud" follow className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Welcome to the guild</p>
          <h2 id="getting-started" className="mt-1.5 text-[17px] font-semibold tracking-[-0.01em] text-ink">
            Five small things and you’re properly in.
          </h2>
          <div className="mt-2.5 flex items-center gap-3">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-kinu" role="progressbar" aria-label="Getting started" aria-valuemin={0} aria-valuemax={STEPS.length} aria-valuenow={doneCount}>
              <div className="h-full rounded-full bg-ink transition-[width] duration-500" style={{ width: `${(doneCount / STEPS.length) * 100}%` }} />
            </div>
            <span className="text-meta text-ink-muted tabular">{doneCount} of {STEPS.length}</span>
          </div>
        </div>
      </div>

      <ol className="mt-5 divide-y divide-separator border-y border-separator">
        {STEPS.map(step => {
          const done = data.done[step.key]
          return (
            <li key={step.key} className="flex items-center gap-3 py-3">
              <span
                aria-hidden
                className={cn('grid size-5 shrink-0 place-items-center rounded-full border', done ? 'border-ink bg-ink text-parchment' : 'border-border-strong')}
              >
                {done && <Check weight="bold" className="size-3" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className={cn('text-footnote', done ? 'text-ink-muted line-through decoration-border-strong' : 'text-ink')}>
                  {step.title}
                  <span className="sr-only">{done ? ' (done)' : ''}</span>
                </p>
                {!done && <p className="text-meta text-ink-muted">{step.hint}</p>}
              </div>
              {!done && step.href && (
                <Link href={step.href} className="press shrink-0 inline-flex h-8 items-center rounded-full bg-kinu/70 px-3 text-footnote text-ink-soft hover:bg-kinu hover:text-ink">
                  {step.cta}
                </Link>
              )}
              {!done && step.key === 'notifications' && <span className="shrink-0"><PushToggleButton /></span>}
            </li>
          )
        })}
      </ol>

      <button
        type="button"
        onClick={() => { try { localStorage.setItem(HIDE_KEY, '1') } catch {}; setHidden(true); onDone?.() }}
        className="mt-3 text-meta text-ink-muted hover:text-ink"
      >
        Hide this
      </button>
    </section>
  )
}
