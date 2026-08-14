'use client'

import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { Check, ChatCircle } from '@phosphor-icons/react/dist/ssr'
import { DOMAIN_LABELS, type Domain } from '@/lib/bytes/domains'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/utils/cn'

const SOURCE_LABELS: Record<string, string> = {
  hn: 'Hacker News',
  lobsters: 'Lobsters',
  devto: 'dev.to',
  github: 'GitHub',
}

export interface Byte {
  id: string
  source: string
  source_title: string
  url: string
  source_points: number | null
  summary: string | null
  tags: string[] | null
  editor_note: string | null
  domain: string | null
  interest_count: number
  seeded_topic_id: string | null
  user_interested?: boolean
  digest_label?: string | null
}

interface ByteCardProps {
  byte: Byte
  /** Top stories carry a rank number. Everything else renders identically:
      one row treatment, so the two sections read as one list. */
  rank?: number
}

export function ByteCard({ byte, rank }: ByteCardProps) {
  const reduceMotion = useReducedMotion()
  const [interested, setInterested] = useState(!!byte.user_interested)
  const [count, setCount] = useState(byte.interest_count)
  const [busy, setBusy] = useState(false)

  const domain = byte.domain as Domain | null

  const toggle = async () => {
    if (busy) return
    setBusy(true)

    // Optimistic: the tap has to register instantly or the whole affordance
    // reads as broken.
    const was = interested
    setInterested(!was)
    setCount(c => Math.max(0, c + (was ? -1 : 1)))

    try {
      const res = await fetch('/api/byte-interests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ byte_id: byte.id }),
      })
      if (!res.ok) throw new Error()
    } catch {
      setInterested(was)
      setCount(c => Math.max(0, c + (was ? 1 : -1)))
    } finally {
      setBusy(false)
    }
  }

  return (
    <article className="group relative flex gap-3 px-4 py-3.5 transition-colors hover:bg-kinu/20">
      {/* Rank sits in its own column as plain text. It was a saffron disc
          pinned outside the card corner, which put the loudest colour on the
          page next to the least important number on it. */}
      {/* Saffron here is earned: a rank only exists in "Top right now", and
          that ordering is the guild's own interest taps rather than a feed
          score. It is the one thing on this page the members produced. */}
      {rank !== undefined && (
        <span aria-hidden className="w-5 shrink-0 pt-0.5 text-footnote text-saffron tabular">
          {rank}
        </span>
      )}

      <div className="min-w-0 flex-1">
        {/* Provenance on one quiet line. The digest label used to repeat on
            every featured row; it is stated once in the page header instead. */}
        <div className="flex items-center gap-1.5 flex-wrap text-meta text-ink-muted">
          {domain && DOMAIN_LABELS[domain] && (
            <>
              <span className="text-ink-soft">{DOMAIN_LABELS[domain]}</span>
              <span aria-hidden>&middot;</span>
            </>
          )}
          <span>{SOURCE_LABELS[byte.source] ?? byte.source}</span>
          {byte.source_points ? (
            <>
              <span aria-hidden>&middot;</span>
              <span className="tabular">{byte.source_points.toLocaleString()}</span>
            </>
          ) : null}
        </div>

        <a
          href={byte.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-1 block text-body text-ink hover:text-saffron transition-colors"
        >
          {byte.source_title}
        </a>

        {byte.summary && (
          <p className="text-footnote text-ink-soft mt-1 line-clamp-2">{byte.summary}</p>
        )}

        {/* The human voice. This is what makes a digest get read. */}
        {byte.editor_note && (
          <p className="text-footnote text-ink mt-1.5 pl-2.5 border-l-2 border-saffron/40">
            {byte.editor_note}
          </p>
        )}

        {byte.seeded_topic_id && (
          <a
            href={`/board/${byte.seeded_topic_id}`}
            className="mt-1.5 inline-block text-meta text-saffron hover:underline"
          >
            On the board
          </a>
        )}
      </div>

      {/* One compact control, right-aligned, out of the reading path. It was a
          full-width pill under every story, which made the action louder than
          the headline it belonged to. */}
      <motion.button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={interested}
        aria-label={interested ? 'Remove from discussion list' : "I'd discuss this"}
        title={interested ? 'On your list' : "I'd discuss this"}
        whileTap={reduceMotion ? undefined : { scale: 0.94 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
        className={cn(
          'self-start shrink-0 inline-flex items-center gap-1.5 h-7 px-2 rounded-md border text-meta transition-colors disabled:opacity-60',
          interested
            ? 'border-saffron/40 bg-saffron/12 text-saffron'
            : count > 0
              // Someone in the guild already wants this discussed. That is a
              // signal worth carrying colour even before you have tapped.
              ? 'border-saffron/25 text-saffron hover:bg-saffron/12'
              : 'border-border text-ink-muted hover:border-border-strong hover:text-ink-soft',
        )}
      >
        <Icon icon={interested ? Check : ChatCircle} size="sm" />
        {count > 0 && <span className="tabular">{count}</span>}
      </motion.button>
    </article>
  )
}
