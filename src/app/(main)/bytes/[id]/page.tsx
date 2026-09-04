'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowSquareOut, Sparkle } from '@phosphor-icons/react/dist/ssr'
import { Icon } from '@/components/ui/Icon'
import { InterestButton } from '@/components/bytes/InterestButton'
import { DOMAIN_LABELS, type Domain } from '@/lib/bytes/domains'
import { mediumLabel, compactCount, POINT_LABELS } from '@/lib/bytes/labels'

/**
 * Read a byte here, when the publisher syndicated it.
 *
 * Roughly half the feeds ship the whole article in the feed element, and those
 * rows render below. The rest are link-outs and never link here in the first
 * place - a truncated feed is the publisher asking readers to come to them,
 * and the answer to that is to send them, not to go and fetch the text anyway.
 *
 * Landing here by URL on a link-out row is still handled: the page falls back
 * to the summary and a button to the original, which is the honest version of
 * what it knows.
 */

interface ReaderByte {
  id: string
  source: string
  source_title: string
  source_name: string | null
  url: string
  source_points: number | null
  summary: string | null
  editor_note: string | null
  domain: string | null
  interest_count: number
  seeded_topic_id: string | null
  user_interested?: boolean
  content_html: string | null
  reading_minutes: number | null
}

export default function ByteReaderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [byte, setByte] = useState<ReaderByte | null>(null)
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    let cancelled = false

    fetch(`/api/bytes/${id}`, { cache: 'no-store' })
      .then(async r => {
        if (r.status === 404) {
          if (!cancelled) setMissing(true)
          return null
        }
        return r.ok ? r.json() : null
      })
      .then(data => {
        if (!cancelled && data) setByte(data.byte ?? null)
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [id])

  const publisher = byte?.source_name?.trim() || (byte ? mediumLabel(byte.source) : '')
  const domain = byte?.domain as Domain | null | undefined
  const pointLabel = byte ? POINT_LABELS[byte.source] : undefined

  const original = byte && (
    <a
      href={byte.url}
      target="_blank"
      rel="noopener noreferrer"
      className="press inline-flex items-center gap-1.5 text-caption text-accent hover:underline"
    >
      Read the original on {publisher}
      <Icon icon={ArrowSquareOut} size="sm" />
    </a>
  )

  return (
    <div className="px-5 md:px-10 py-8 w-full max-w-2xl mx-auto pb-28 md:pb-10">
      <Link
        href="/bytes"
        className="press inline-flex items-center gap-1.5 text-caption text-ink-muted hover:text-ink transition-colors mb-6"
      >
        <Icon icon={ArrowLeft} size="sm" />
        Bytes
      </Link>

      {loading ? (
        <div aria-busy="true" aria-label="Loading" className="animate-pulse-soft">
          <div className="h-3 w-40 bg-fill rounded mb-4" />
          <div className="h-7 w-full bg-fill-strong rounded mb-2" />
          <div className="h-7 w-2/3 bg-fill-strong rounded mb-8" />
          <div className="space-y-2.5">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className="h-3 w-full bg-fill rounded" />
            ))}
          </div>
        </div>
      ) : missing || !byte ? (
        <p className="text-callout text-ink-muted py-10">
          That story is not in a live digest.{' '}
          <Link href="/bytes" className="text-saffron hover:underline">
            Back to Bytes
          </Link>
          .
        </p>
      ) : (
        <article>
          {/* ─── Provenance, before the headline ───
              Whose work this is, said before the first word of it is shown. */}
          <div className="flex items-center gap-1.5 flex-wrap text-meta text-ink-muted mb-2.5">
            <span className="text-ink-soft">{mediumLabel(byte.source)}</span>
            <span aria-hidden>&middot;</span>
            <span className="text-ink">{publisher}</span>
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
            {byte.reading_minutes && (
              <>
                <span aria-hidden>&middot;</span>
                <span className="tabular">{byte.reading_minutes} min read</span>
              </>
            )}
          </div>

          <h1 className="text-title-1 text-label">{byte.source_title}</h1>

          <div className="mt-3">{original}</div>

          {/* Labelled, always. A machine-written paragraph sitting in the same
              type as the article it precedes is the one thing that would make
              this page untrustworthy. */}
          {byte.summary && (
            <div className="mt-6 rounded-(--radius-card) border border-border bg-paper/50 p-4">
              <p className="flex items-center gap-1.5 text-meta text-ink-muted mb-1.5">
                <Icon icon={Sparkle} size="sm" />
                AI-drafted summary
              </p>
              <p className="text-footnote text-ink-soft">{byte.summary}</p>
            </div>
          )}

          {/* The human voice. This is what makes a digest get read. */}
          {byte.editor_note && (
            <p className="text-footnote text-ink mt-4 pl-3 border-l-2 border-saffron/40">
              {byte.editor_note}
            </p>
          )}

          {byte.content_html ? (
            <>
              {/* Sanitized server-side on the way out of /api/bytes/[id], with
                  an allowlist that permits no script, iframe, style or event
                  handler. Never render this without that pass. */}
              <div
                className="prose-guild prose-read mt-8"
                dangerouslySetInnerHTML={{ __html: byte.content_html }}
              />
              <p className="text-meta text-ink-muted mt-8">
                Published by {publisher} and syndicated in full through their own feed.
                Copyright remains theirs.
              </p>
            </>
          ) : (
            /* A link-out row reached by URL. Say what it is and point at the
               publisher rather than showing an article-shaped empty page. */
            <div className="mt-8 rounded-(--radius-card) border border-border bg-paper/40 p-5 text-center">
              <p className="text-footnote text-ink-soft">
                {publisher} publishes this one on their own site only.
              </p>
              <a
                href={byte.url}
                target="_blank"
                rel="noopener noreferrer"
                className="press mt-3 inline-flex items-center gap-2 h-(--control-h) px-4 rounded-(--radius-control) border border-saffron/40 bg-saffron/12 text-saffron text-footnote hover:bg-saffron/20 transition-colors"
              >
                Read the full article on {publisher}
                <Icon icon={ArrowSquareOut} size="sm" />
              </a>
            </div>
          )}

          <footer className="mt-10 pt-6 border-t border-border flex flex-wrap items-center gap-3">
            <InterestButton
              byteId={byte.id}
              initialCount={byte.interest_count}
              initialInterested={!!byte.user_interested}
              layout="wide"
            />
            {original}
            {byte.seeded_topic_id && (
              <Link
                href={`/board/${byte.seeded_topic_id}`}
                className="text-caption text-saffron hover:underline ml-auto"
              >
                On the board
              </Link>
            )}
          </footer>
        </article>
      )}
    </div>
  )
}
