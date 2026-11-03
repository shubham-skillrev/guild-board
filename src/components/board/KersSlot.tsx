'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Kers } from '@/components/kers/Kers'
import { Button } from '@/components/ui/Button'
import { useGuestGate } from '@/components/auth/GuestGate'
import { SpotlightInvite } from '@/components/showtell/SpotlightInvite'
import { NudgeCard } from '@/components/board/NudgeCard'
import { GettingStarted } from '@/components/board/GettingStarted'
import { VolunteerModal } from '@/components/showtell/ShowAndTell'
import { AddLink } from '@/components/radar/RadarSection'
import { useShowTell } from '@/components/showtell/useShowTell'
import type { Step, StepKind } from '@/lib/guild/nextSteps'

/* "Not now" puts a step away for a week. The survey gives up after three. */
const SNOOZE_DAYS = 7
const SURVEY_MAX = 3
const key = (k: StepKind) => `gb-slot:${k}`

function snoozed(kind: StepKind): boolean {
  try {
    const raw = JSON.parse(localStorage.getItem(key(kind)) ?? 'null') as { until: number; count: number } | null
    if (!raw) return false
    if (kind === 'survey' && raw.count >= SURVEY_MAX) return true
    return raw.until > Date.now()
  } catch {
    return false
  }
}

function snooze(kind: StepKind) {
  try {
    const prev = JSON.parse(localStorage.getItem(key(kind)) ?? 'null') as { count: number } | null
    localStorage.setItem(key(kind), JSON.stringify({ until: Date.now() + SNOOZE_DAYS * 86_400_000, count: (prev?.count ?? 0) + 1 }))
  } catch {}
}

/**
 * One Kers card at the top of the board: the single most useful thing this
 * person could do next (an invitation to answer, a note, their first week,
 * the survey, the demo slot, the Radar). Closing or "Not now" moves to the
 * next one, so the board never stacks a pile of banners.
 */
export function KersSlot() {
  const reduce = useReducedMotion()
  const { blockGuest } = useGuestGate()
  const { data: showTell, refresh } = useShowTell()
  const [steps, setSteps] = useState<Step[] | null>(null)
  const [modal, setModal] = useState<'volunteer' | 'radar' | null>(null)

  useEffect(() => {
    let alive = true
    fetch('/api/me/next', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive && d?.steps) setSteps((d.steps as Step[]).filter(s => !snoozed(s.kind))) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  const advance = useCallback(() => setSteps(s => (s ? s.slice(1) : s)), [])
  const notNow = (kind: StepKind) => { snooze(kind); advance() }

  const step = steps?.[0]
  const more = (steps?.length ?? 0) - 1

  let card: React.ReactNode = null
  if (step?.kind === 'invite') card = <SpotlightInvite onDone={advance} />
  else if (step?.kind === 'note') card = <NudgeCard onDone={advance} />
  else if (step?.kind === 'getting_started') card = <GettingStarted onDone={advance} />
  else if (step?.kind === 'survey') {
    card = (
      <Ask
        title="Two minutes for the guild?"
        body="Seven quick questions on what would make the monthly meeting worth your hour. Kers is counting the answers."
        action={<Link href="/survey" className="press inline-flex h-8 items-center rounded-full bg-ink px-3.5 text-footnote font-medium text-parchment hover:bg-ink/85 pointer-coarse:h-10">Answer the survey</Link>}
        onNotNow={() => notNow('survey')}
        more={more}
      />
    )
  } else if (step?.kind === 'volunteer') {
    card = (
      <Ask
        title={step.idea ? 'Remember what you said you could show?' : 'The demo slot is still open.'}
        body={step.idea
          ? `“${step.idea}”. The demo slot at the ${showTell?.cycle?.label ?? 'next'} meeting is still open, and ten minutes is all it takes.`
          : `Ten minutes at the ${showTell?.cycle?.label ?? 'next'} meeting: a tool you use, a script that saves time, a bug that ate your week. No slides.`}
        action={<Button className="h-8" onClick={() => { if (!blockGuest()) setModal('volunteer') }}>Take the demo slot</Button>}
        onNotNow={() => notNow('volunteer')}
        more={more}
      />
    )
  } else if (step?.kind === 'radar') {
    card = (
      <Ask
        title="Seen something new this month?"
        body="Put one link on the Radar. The top three open the meeting, and it takes ten seconds."
        action={<Button variant="secondary" className="h-8" onClick={() => { if (!blockGuest()) setModal('radar') }}>Add a link</Button>}
        onNotNow={() => notNow('radar')}
        more={more}
      />
    )
  }

  return (
    <>
      <AnimatePresence initial={false} mode="wait">
        {card && (
          <motion.div
            key={step!.kind}
            initial={reduce ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6 }}
            transition={{ type: 'spring', bounce: 0, duration: 0.35 }}
          >
            {card}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {modal === 'volunteer' && (
          <VolunteerModal
            meeting={showTell?.cycle?.label ?? 'next'}
            initialTitle={step?.kind === 'volunteer' ? step.idea ?? '' : ''}
            onClose={() => setModal(null)}
            onDone={() => { refresh(); advance() }}
          />
        )}
        {modal === 'radar' && <AddLink onClose={() => setModal(null)} onDone={advance} />}
      </AnimatePresence>
    </>
  )
}

function Ask({ title, body, action, onNotNow, more }: { title: string; body: string; action: React.ReactNode; onNotNow: () => void; more: number }) {
  return (
    <section aria-label={title} className="elev-1 rounded-(--radius-card) p-4 sm:p-5 flex items-center gap-4 sm:gap-5">
      <Kers size={64} expression="nosy" follow className="shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{title}</p>
        <p className="mt-1 text-footnote leading-relaxed text-ink-soft">{body}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {action}
          <button type="button" onClick={onNotNow} className="press inline-flex h-8 items-center rounded-full px-3 text-footnote text-ink-muted hover:bg-kinu/60 hover:text-ink pointer-coarse:h-10">
            Not now
          </button>
          {more > 0 && <span className="ml-auto text-meta text-ink-muted">Kers has {more} more idea{more === 1 ? '' : 's'}</span>}
        </div>
      </div>
    </section>
  )
}
