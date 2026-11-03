'use client'

import Image from 'next/image'
import Link from 'next/link'
import { PlayCircle } from '@phosphor-icons/react/dist/ssr'
import { DOMAIN_LABELS, type Domain } from '@/lib/bytes/domains'
import { InterestButton } from '@/components/bytes/InterestButton'
import {
  POINT_LABELS,
  compactCount,
  mediumLabel,
} from '@/lib/bytes/labels'
import { cn } from '@/lib/utils/cn'

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
  /** Read time of the original, when its feed carried the whole piece. */
  reading_minutes?: number | null
}

interface ByteCardProps {
  byte: Byte
}

export function ByteCard({ byte }: ByteCardProps) {
  const domain = byte.domain as Domain | null
  const isVideo = byte.source === 'video'
  const publisher = byte.source_name?.trim() || mediumLabel(byte.source)
  const pointLabel = POINT_LABELS[byte.source]

  /* Every byte opens its brief here (summary, try-this, resources); the brief
     is where the way out to the publisher lives. */
  const briefHref = `/bytes/${byte.id}`

  return (
    <article className="group relative flex gap-3 px-4 py-3.5 transition-colors hover:bg-kinu/20">
      {/* A talk needs a still frame or it reads as one more blue link. Small
          and fixed-size, so ten rows still fit on a phone screen. */}
      {isVideo && byte.thumbnail_url && (
        <Link
          href={briefHref}
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
        </Link>
      )}

      <div className="min-w-0 flex-1">
        {/* Provenance on one quiet line: medium, who published it, and how it
            did on its own platform. The digest label used to repeat on every
            featured row; it is stated once in the page header instead. */}
        <div className="flex items-center gap-1.5 flex-wrap text-meta text-ink-muted">
          <span className={cn('text-ink-soft', isVideo && 'text-cha')}>
            {mediumLabel(byte.source)}
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
                {compactCount(byte.source_points)}
                {pointLabel ? ` ${pointLabel}` : ''}
              </span>
            </>
          ) : null}
          {byte.reading_minutes ? (
            <>
              <span aria-hidden>&middot;</span>
              <span className="tabular">{byte.reading_minutes} min read</span>
            </>
          ) : null}
        </div>

        <Link
          href={briefHref}
          className="mt-1 block text-body text-ink hover:text-saffron transition-colors"
        >
          {byte.source_title}
        </Link>

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
          <Link
            href={`/board/${byte.seeded_topic_id}`}
            className="mt-1.5 inline-block text-meta text-saffron hover:underline"
          >
            On the board
          </Link>
        )}
      </div>

      {/* Upvote, same arrow and same stacked count as a topic on the board.
          It was a speech bubble, which read as "comment on this" - the opposite
          of what the tap does. The action is a vote for the meeting agenda, so
          it should look like every other vote in the product. */}
      <InterestButton
        byteId={byte.id}
        initialCount={byte.interest_count}
        initialInterested={!!byte.user_interested}
      />
    </article>
  )
}
