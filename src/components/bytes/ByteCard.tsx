'use client'

import { useState } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { DOMAIN_ICONS, DOMAIN_LABELS, type Domain } from '@/lib/bytes/domains'
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
  /** Top stories get more visual weight and a rank marker. */
  featured?: boolean
  rank?: number
}

export function ByteCard({ byte, featured = false, rank }: ByteCardProps) {
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
    <article
      className={cn(
        'group relative rounded-2xl border transition-colors',
        featured
          ? 'material-raised border-saffron/20 p-4 sm:p-5'
          : 'bg-paper/40 border-border p-4 hover:border-border-strong',
      )}
    >
      {featured && rank !== undefined && (
        <span
          aria-hidden
          className="absolute -top-2 -left-2 w-6 h-6 rounded-full bg-saffron text-parchment text-[11px] font-bold grid place-items-center shadow-lg tabular"
        >
          {rank}
        </span>
      )}

      {/* Meta row: where it came from and what area it covers. */}
      <div className="flex items-center gap-2 flex-wrap mb-2">
        {domain && DOMAIN_LABELS[domain] && (
          <span className="inline-flex items-center gap-1 type-caption text-ink-soft">
            <span aria-hidden>{DOMAIN_ICONS[domain]}</span>
            {DOMAIN_LABELS[domain]}
          </span>
        )}
        <span className="type-caption text-cha">
          {SOURCE_LABELS[byte.source] ?? byte.source}
        </span>
        {byte.source_points ? (
          <span className="type-caption text-cha tabular">▲ {byte.source_points.toLocaleString()}</span>
        ) : null}
        {byte.digest_label && featured && (
          <span className="type-caption text-cha ml-auto">{byte.digest_label}</span>
        )}
      </div>

      <a
        href={byte.url}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          'block text-ink hover:text-saffron transition-colors press',
          featured ? 'type-title' : 'type-title text-[15px]',
        )}
      >
        {byte.source_title}
      </a>

      {byte.summary && (
        <p className="type-body text-ink-soft mt-2">{byte.summary}</p>
      )}

      {/* The human voice. This is what makes a digest get read. */}
      {byte.editor_note && (
        <p className="type-body text-ink mt-2.5 pl-3 border-l-2 border-saffron/40">
          {byte.editor_note}
        </p>
      )}

      <div className="flex items-center gap-2 mt-3.5 flex-wrap">
        <motion.button
          type="button"
          onClick={toggle}
          disabled={busy}
          aria-pressed={interested}
          aria-label={interested ? 'Remove from discussion list' : 'Add to discussion list'}
          // Critically damped by default; a touch of bounce only on the way in,
          // because that press carried intent.
          whileTap={reduceMotion ? undefined : { scale: 0.94 }}
          animate={reduceMotion ? undefined : { scale: 1 }}
          transition={{ type: 'spring', bounce: interested ? 0.3 : 0, duration: 0.35 }}
          className={cn(
            'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border type-caption transition-colors disabled:opacity-60',
            interested
              ? 'border-saffron/40 bg-saffron-light text-saffron'
              : 'border-border text-ink-soft hover:border-border-strong hover:bg-kinu/40',
          )}
        >
          <span aria-hidden>{interested ? '✓' : '💬'}</span>
          <span>{interested ? 'On your list' : "I'd discuss this"}</span>
          {count > 0 && <span className="tabular opacity-80">{count}</span>}
        </motion.button>

        {byte.seeded_topic_id && (
          <a
            href={`/board/${byte.seeded_topic_id}`}
            className="type-caption text-saffron hover:underline press"
          >
            On the board →
          </a>
        )}

        {byte.tags?.length ? (
          <span className="ml-auto flex gap-1.5 flex-wrap">
            {byte.tags.slice(0, 3).map(t => (
              <span key={t} className="type-caption text-cha">
                #{t}
              </span>
            ))}
          </span>
        ) : null}
      </div>
    </article>
  )
}
