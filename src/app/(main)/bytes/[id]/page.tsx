'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowLeft, ArrowSquareOut, Sparkle } from '@phosphor-icons/react/dist/ssr'
import { Icon } from '@/components/ui/Icon'
import { InterestButton } from '@/components/bytes/InterestButton'
import { DOMAIN_LABELS, type Domain } from '@/lib/bytes/domains'
import { mediumLabel, compactCount, POINT_LABELS, youtubeId } from '@/lib/bytes/labels'

/**
 * Read a byte without leaving the app.
 *
 * The digest's whole job is to collect upvotes for the meeting agenda, and
 * every row used to be a link out - to a page with a cookie banner, a
 * newsletter modal and no way back. People read the article and never returned
 * to press the one button the feature exists for. The body lands here instead,
 * with the upvote directly under it.
 *
 * The text belongs to whoever published it, so the publisher's name sits above
 * the first line and a link to the original sits at the top and the bottom.
 * This is a reading view of someone else's work, and it says so on the page.
 */

interface ReaderByte {
  id: string
  source: string
  source_id: string
  source_title: string
  source_name: string | null
  url: string
  thumbnail_url: string | null
  source_points: number | null
  summary: string | null
  tags: string[] | null
  editor_note: string | null
  domain: string | null
  interest_count: number
  seeded_topic_id: string | null
  user_interested?: boolean
  content_md: string | null
  reading_minutes: number | null
}

export default function ByteReaderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [byte, setByte] = useState<ReaderByte | null>(null)
  const [unreadable, setUnreadable] = useState(false)
  const [loading, setLoading] = useState(true)
  const [missing, setMissing] = useState(false)

  useEffect(() => {
    let cancelled = false

    fetch(`/api/bytes/${id}/read`, { cache: 'no-store' })
      .then(async r => {
        if (r.status === 404) {
          if (!cancelled) setMissing(true)
          return null
        }
        return r.ok ? r.json() : null
      })
      .then(data => {
        if (cancelled || !data) return
        setByte(data.byte ?? null)
        setUnreadable(!!data.unreadable)
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
  const videoId = byte ? youtubeId(byte.source, byte.source_id) : null
  const domain = byte?.domain as Domain | null | undefined
  const pointLabel = byte ? POINT_LABELS[byte.source] : undefined

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

          <a
            href={byte.url}
            target="_blank"
            rel="noopener noreferrer"
            className="press mt-3 inline-flex items-center gap-1.5 text-caption text-accent hover:underline"
          >
            Read the original on {publisher}
            <Icon icon={ArrowSquareOut} size="sm" />
          </a>

          {/* A talk's body is the talk. nocookie so an embed does not set an
              advertising cookie on a member who only opened a page. */}
          {videoId && (
            <div className="mt-6 aspect-video w-full overflow-hidden rounded-(--radius-card) border border-border bg-kinu">
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${videoId}`}
                title={byte.source_title}
                allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
                allowFullScreen
                loading="lazy"
                referrerPolicy="strict-origin-when-cross-origin"
                className="w-full h-full border-0"
              />
            </div>
          )}

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

          {byte.content_md ? (
            <div className="prose-guild prose-read mt-8">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{byte.content_md}</ReactMarkdown>
            </div>
          ) : unreadable ? (
            <p className="text-footnote text-ink-muted mt-8 py-6 border-y border-border">
              This one will not open here - the publisher serves it behind a paywall,
              a login, or a page this reader cannot transcribe. The link above goes
              to the original.
            </p>
          ) : null}

          {/* ─── Attribution and the one action ─── */}
          <footer className="mt-10 pt-6 border-t border-border flex flex-wrap items-center gap-3">
            <InterestButton
              byteId={byte.id}
              initialCount={byte.interest_count}
              initialInterested={!!byte.user_interested}
              layout="wide"
            />
            <a
              href={byte.url}
              target="_blank"
              rel="noopener noreferrer"
              className="press inline-flex items-center gap-1.5 text-caption text-accent hover:underline"
            >
              Read the original on {publisher}
              <Icon icon={ArrowSquareOut} size="sm" />
            </a>
            {byte.seeded_topic_id && (
              <Link
                href={`/board/${byte.seeded_topic_id}`}
                className="text-caption text-saffron hover:underline ml-auto"
              >
                On the board
              </Link>
            )}
          </footer>

          {byte.content_md && (
            <p className="text-meta text-ink-muted mt-4">
              Text published by {publisher}, shown here for the guild. Copyright remains
              theirs.
            </p>
          )}
        </article>
      )}
    </div>
  )
}
