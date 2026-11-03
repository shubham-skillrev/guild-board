'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Kers } from '@/components/kers/Kers'

interface Status {
  survey: string
  open: boolean
  answered: boolean
  member: boolean
  /** In their first two weeks: the getting-started card covers the survey. */
  newMember?: boolean
}

/* "Later" hides the card for a week, and after the third "Later" it stops
   asking. Kept per browser: it is a courtesy, not a rule. */
const LATER_DAYS = 7
const MAX_LATERS = 3

interface Later { until: number; count: number }

function readLater(survey: string): Later {
  try {
    const raw = JSON.parse(localStorage.getItem(`gb-survey-later:${survey}`) ?? 'null')
    if (raw && typeof raw.until === 'number' && typeof raw.count === 'number') return raw
  } catch {}
  return { until: 0, count: 0 }
}

/**
 * Kers asking for the guild survey, at the top of the board. Shown while the
 * survey is open to members who haven't answered (matched by email on the
 * server) and to guests, who get the same card without knowing who they are.
 */
export function SurveyCard() {
  const reduce = useReducedMotion()
  const [status, setStatus] = useState<Status | null>(null)
  const [hidden, setHidden] = useState(true)

  useEffect(() => {
    let alive = true
    fetch('/api/survey/status')
      .then(r => (r.ok ? r.json() : null))
      .then((s: Status | null) => {
        if (!alive || !s || !s.open || s.answered || s.newMember) return
        const later = readLater(s.survey)
        if (later.count >= MAX_LATERS || later.until > Date.now()) return
        setStatus(s)
        setHidden(false)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  const later = () => {
    if (!status) return
    const prev = readLater(status.survey)
    try {
      localStorage.setItem(
        `gb-survey-later:${status.survey}`,
        JSON.stringify({ until: Date.now() + LATER_DAYS * 86_400_000, count: prev.count + 1 }),
      )
    } catch {}
    setHidden(true)
  }

  return (
    <AnimatePresence initial={false}>
      {!hidden && status && (
        <motion.section
          aria-label="Guild survey"
          initial={reduce ? false : { opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0, marginBottom: 0 }}
          transition={{ type: 'spring', bounce: 0, duration: 0.4 }}
          className="overflow-hidden"
        >
          <div className="elev-1 rounded-(--radius-card) p-4 sm:p-5 flex items-center gap-4 sm:gap-5">
            <Kers size={64} expression="nosy" follow className="shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold tracking-[-0.01em] text-ink">Two minutes for the guild?</p>
              <p className="mt-1 text-footnote leading-relaxed text-ink-soft">
                Seven quick questions on what would make the monthly meeting worth your hour. Kers is
                counting the answers.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Link
                  href="/survey"
                  className="press inline-flex items-center h-8 px-3.5 rounded-full bg-ink text-parchment text-footnote font-medium hover:bg-ink/85 transition-colors pointer-coarse:h-10 pointer-coarse:px-4"
                >
                  Answer the survey
                </Link>
                <button
                  type="button"
                  onClick={later}
                  className="press inline-flex items-center h-8 px-3 rounded-full text-footnote text-ink-muted hover:text-ink hover:bg-kinu/60 transition-colors pointer-coarse:h-10"
                >
                  Later
                </button>
              </div>
            </div>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  )
}
