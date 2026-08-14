'use client'

import { useState } from 'react'
import Image from 'next/image'
import { motion, useReducedMotion } from 'framer-motion'
import { ArrowFatUp, PlayCircle } from '@phosphor-icons/react/dist/ssr'
import { DOMAIN_LABELS, type Domain } from '@/lib/bytes/domains'
import { cn } from '@/lib/utils/cn'

/**
 * What the item is, not where we found it. A reader does not care that a piece
 * surfaced through the Hacker News API; they care whether it is an article, a
 * report or a talk, because that decides whether they have time for it now.
 */
const MEDIUM_LABELS: Record<string, string> = {
  blog: 'Article',
  hn: 'Article',
  news: 'News',
  video: 'Video',
  // Retired sources, still present in older digests.
  github: 'Repo',
  lobsters: 'Article',
  devto: 'Article',
}

/** Units differ per source, and an unlabelled 405,801 next to a 312 is noise. */
const POINT_LABELS: Record<string, string> = {
  hn: 'points',
  video: 'views',
  github: 'stars',
}

export interface Byte {
  id: string
  source: string
  source_title: string
  source_name?: string | null
  url: string
  thumbnail_url?: string | null
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
}

function compact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1).replace(/\.0$/, '')}K`
  return String(n)
}

export function ByteCard({ byte }: ByteCardProps) {
  const reduceMotion = useReducedMotion()
  const [interested, setInterested] = useState(!!byte.user_interested)
  const [count, setCount] = useState(byte.interest_count)
  const [busy, setBusy] = useState(false)

  const domain = byte.domain as Domain | null
  const isVideo = byte.source === 'video'
  const publisher = byte.source_name?.trim() || MEDIUM_LABELS[byte.source] || byte.source
  const pointLabel = POINT_LABELS[byte.source]

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
      {/* A talk needs a still frame or it reads as one more blue link. Small
          and fixed-size, so ten rows still fit on a phone screen. */}
      {isVideo && byte.thumbnail_url && (
        <a
          href={byte.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-hidden
          tabIndex={-1}
          className="relative shrink-0 w-24 h-14 rounded-(--radius-control) overflow-hidden border border-border bg-kinu"
        >
          <Image
            src={byte.thumbnail_url}
            alt=""
            fill
            sizes="96px"
            className="object-cover"
          />
          <span className="absolute inset-0 grid place-items-center bg-black/25 text-white/90">
            <PlayCircle className="w-6 h-6" weight="fill" />
          </span>
        </a>
      )}

      <div className="min-w-0 flex-1">
        {/* Provenance on one quiet line: medium, who published it, and how it
            did on its own platform. The digest label used to repeat on every
            featured row; it is stated once in the page header instead. */}
        <div className="flex items-center gap-1.5 flex-wrap text-meta text-ink-muted">
          <span className={cn('text-ink-soft', isVideo && 'text-cha')}>
            {MEDIUM_LABELS[byte.source] ?? byte.source}
          </span>
          <span aria-hidden>&middot;</span>
          <span>{publisher}</span>
          {domain && DOMAIN_LABELS[domain] && (
            <>
              <span aria-hidden>&middot;</span>
              <span>{DOMAIN_LABELS[domain]}</span>
            </>
          )}
          {byte.source_points ? (
            <>
              <span aria-hidden>&middot;</span>
              <span className="tabular">
                {compact(byte.source_points)}
                {pointLabel ? ` ${pointLabel}` : ''}
              </span>
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

      {/* Upvote, same arrow and same stacked count as a topic on the board.
          It was a speech bubble, which read as "comment on this" - the opposite
          of what the tap does. The action is a vote for the meeting agenda, so
          it should look like every other vote in the product, and the number
          shows even at zero: a visible 0 is an invitation, a hidden one is a
          control nobody notices. */}
      <motion.button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={interested}
        aria-label={
          interested ? 'Remove your upvote' : 'Upvote to discuss this at the guild meet'
        }
        title={interested ? 'On the agenda list' : 'Discuss this at the guild meet'}
        whileTap={reduceMotion ? undefined : { scale: 0.94 }}
        transition={{ type: 'spring', bounce: 0, duration: 0.3 }}
        className={cn(
          'self-start shrink-0 flex flex-col items-center justify-center gap-0.5 w-11 h-12 rounded-(--radius-control) border transition-colors disabled:opacity-60',
          interested
            ? 'border-saffron/50 bg-saffron/15 text-saffron'
            : count > 0
              // Someone in the guild already wants this discussed. That is a
              // signal worth carrying colour even before you have tapped.
              ? 'border-saffron/25 text-saffron hover:bg-saffron/12'
              : 'border-border text-ink-muted hover:border-saffron/45 hover:text-saffron hover:bg-saffron/10',
        )}
      >
        <ArrowFatUp className="w-4.5 h-4.5" weight={interested ? 'fill' : 'regular'} />
        <span className="text-footnote font-bold tabular leading-none">{count}</span>
      </motion.button>
    </article>
  )
}
