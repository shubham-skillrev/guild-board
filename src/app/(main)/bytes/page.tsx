'use client'

import { useEffect, useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ByteCard, type Byte } from '@/components/bytes/ByteCard'

interface Digest {
  id: string
  label: string
  kind?: string
  period_start?: string | null
  published_at: string | null
}

export default function BytesPage() {
  const reduceMotion = useReducedMotion()
  const [digest, setDigest] = useState<Digest | null>(null)
  const [top, setTop] = useState<Byte[]>([])
  const [bytes, setBytes] = useState<Byte[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/bytes')
      .then(r => r.json())
      .then(data => {
        setDigest(data.digest ?? null)
        setTop(Array.isArray(data.top) ? data.top : [])
        setBytes(Array.isArray(data.bytes) ? data.bytes : [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const isEmpty = !digest || (top.length === 0 && bytes.length === 0)

  // Sections arrive as a group rather than each card racing in separately.
  const section = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        transition: { type: 'spring' as const, bounce: 0, duration: 0.4 },
      }

  return (
    <div className="px-5 md:px-10 py-8 w-full max-w-3xl mx-auto pb-28 md:pb-10">
      <header className="mb-7">
        <h1 className="type-display font-serif text-ink">Bytes</h1>
        <p className="type-body text-ink-soft mt-1.5">
          {digest
            ? `${digest.label}. Tap anything you want on the board.`
            : 'What happened in tech, worth two minutes of your week.'}
        </p>
      </header>

      {loading ? (
        <div className="space-y-3" aria-busy="true" aria-label="Loading bytes">
          {[0, 1, 2].map(i => (
            <div key={i} className="rounded-2xl border border-border bg-paper/40 p-4">
              <div className="h-2.5 w-24 bg-kinu/60 rounded mb-3" />
              <div className="h-4 w-3/4 bg-kinu/70 rounded mb-2.5" />
              <div className="h-3 w-full bg-kinu/40 rounded mb-1.5" />
              <div className="h-3 w-2/3 bg-kinu/40 rounded" />
            </div>
          ))}
        </div>
      ) : isEmpty ? (
        <div className="text-center py-20">
          <div className="text-3xl mb-3" aria-hidden>📡</div>
          <p className="type-title text-ink-soft">Nothing yet this week</p>
          <p className="type-body text-cha mt-1.5 max-w-sm mx-auto">
            A fresh digest lands every Monday morning. Tap “I’d discuss this” on anything
            you want turned into a topic.
          </p>
        </div>
      ) : (
        <div className="space-y-9">
          {/* ─── Top: what the guild engaged with most ─── */}
          {top.length > 0 && (
            <motion.section {...section} aria-labelledby="bytes-top">
              <div className="flex items-baseline gap-2 mb-3">
                <h2 id="bytes-top" className="type-title text-ink">
                  Top right now
                </h2>
                <span className="type-caption text-cha">
                  most wanted for discussion
                </span>
              </div>
              <div className="space-y-3">
                {top.map((b, i) => (
                  <ByteCard key={b.id} byte={b} featured rank={i + 1} />
                ))}
              </div>
            </motion.section>
          )}

          {/* ─── This week's fetch ─── */}
          {bytes.length > 0 && (
            <motion.section
              {...section}
              transition={{ ...section.transition, delay: reduceMotion ? 0 : 0.06 }}
              aria-labelledby="bytes-week"
            >
              <div className="flex items-baseline gap-2 mb-3">
                <h2 id="bytes-week" className="type-title text-ink">
                  {digest?.kind === 'weekly' ? 'This week' : 'Also in this digest'}
                </h2>
                <span className="type-caption text-cha tabular">{bytes.length} more</span>
              </div>
              <div className="space-y-3">
                {bytes.map(b => (
                  <ByteCard key={b.id} byte={b} />
                ))}
              </div>
            </motion.section>
          )}

          {/* Say plainly which parts a model wrote. With an engineering
              audience, unlabeled AI text is a credibility risk. */}
          <footer className="pt-2">
            <p className="type-caption text-cha text-center max-w-md mx-auto">
              Headlines and links come straight from Hacker News, Lobsters, dev.to and
              GitHub. Summaries are AI-drafted; the quoted notes are your admin’s own.
            </p>
          </footer>
        </div>
      )}
    </div>
  )
}
