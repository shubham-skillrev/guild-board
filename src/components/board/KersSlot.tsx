'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { X } from '@phosphor-icons/react/dist/ssr'
import { Kers } from '@/components/kers/Kers'
import { useGuestGate } from '@/components/auth/GuestGate'
import { SpotlightInvite } from '@/components/showtell/SpotlightInvite'
import { NudgeCard } from '@/components/board/NudgeCard'
import { GettingStarted } from '@/components/board/GettingStarted'
import { VolunteerModal } from '@/components/showtell/ShowAndTell'
import { AddLink } from '@/components/radar/RadarSection'
import { useShowTell } from '@/components/showtell/useShowTell'
import type { Step, StepKind } from '@/lib/guild/nextSteps'

/* ✕ puts a step away for a week. The survey gives up after three. */
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

  let card: React.ReactNode = null
  const month = showTell?.cycle?.label ?? 'next'
  const primary = 'press inline-flex h-8 shrink-0 items-center rounded-full bg-ink px-3.5 text-footnote font-medium text-parchment hover:bg-ink/85 pointer-coarse:h-10'
  if (step?.kind === 'invite') card = <SpotlightInvite onDone={advance} />
  else if (step?.kind === 'note') card = <NudgeCard onDone={advance} />
  else if (step?.kind === 'getting_started') card = <GettingStarted onDone={advance} />
  else if (step?.kind === 'survey') {
    card = (
      <Ask
        title="Two minutes for the guild?"
        body="Seven quick questions on what would make the meeting worth your hour."
        action={<Link href="/survey" className={primary}>Answer the survey</Link>}
        onHide={() => notNow('survey')}
      />
    )
  } else if (step?.kind === 'volunteer') {
    const idea = shortIdea(step.idea)
    card = (
      <Ask
        title="The demo slot is still open"
        body={idea ? `You said you could show “${idea}”. Ten minutes at the ${month} meeting.` : `Ten minutes at the ${month} meeting: a tool, a script, a bug that ate your week.`}
        action={<button type="button" className={primary} onClick={() => { if (!blockGuest()) setModal('volunteer') }}>Take the slot</button>}
        onHide={() => notNow('volunteer')}
      />
    )
  } else if (step?.kind === 'radar') {
    card = (
      <Ask
        title="Seen something new this month?"
        body="Put one link on the Radar. The top three open the meeting."
        action={<button type="button" className={primary} onClick={() => { if (!blockGuest()) setModal('radar') }}>Add a link</button>}
        onHide={() => notNow('radar')}
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

/** An idea as a short quote: no trailing full stop, at most ~60 characters. */
function shortIdea(idea: string | null | undefined): string {
  const t = (idea ?? '').trim().replace(/[.!\s]+$/, '')
  return t.length > 60 ? `${t.slice(0, 57).trimEnd()}…` : t
}

/**
 * The compact ask: one row on a desktop (Kers, the line, the button), the
 * button under the text on a phone. The ✕ puts it away for a week.
 */
function Ask({ title, body, action, onHide }: { title: string; body: string; action: React.ReactNode; onHide: () => void }) {
  return (
    <section aria-label={title} className="elev-1 relative flex items-center gap-3 rounded-(--radius-card) py-3 pl-3 pr-11 sm:gap-4 sm:pl-4">
      <Kers size={40} expression="nosy" follow className="shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-footnote font-semibold text-ink">{title}</p>
          <p className="line-clamp-2 text-meta leading-snug text-ink-soft sm:line-clamp-1">{body}</p>
        </div>
        <div className="self-start sm:self-auto">{action}</div>
      </div>
      <button
        type="button"
        onClick={onHide}
        aria-label="Hide this for a week"
        title="Hide for a week"
        className="press-sm absolute right-2 top-2 grid size-8 place-items-center rounded-full text-ink-muted hover:bg-kinu/60 hover:text-ink"
      >
        <X className="size-4" />
      </button>
    </section>
  )
}
