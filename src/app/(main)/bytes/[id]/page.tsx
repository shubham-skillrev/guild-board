'use client'

import { use, useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowSquareOut, Lightning, Sparkle } from '@phosphor-icons/react/dist/ssr'
import { Icon } from '@/components/ui/Icon'
import { InterestButton } from '@/components/bytes/InterestButton'
import { DOMAIN_LABELS, type Domain } from '@/lib/bytes/domains'
import { mediumLabel, compactCount, POINT_LABELS } from '@/lib/bytes/labels'

/**
 * A byte as a brief: what it is, what to try, where to go next.
 *
 * The article itself is never shown here. GuildBoard has no licence to
 * republish anyone's writing, and a feed's markup rarely looks right inside
 * the app anyway, so the page is a summary, a few "try this" lines, the links
 * the publisher put in their own piece, and a clear way to the original.
 *
 * Everything machine-written is labelled as such. Titles and every link are
 * the publisher's, verbatim; the model never writes a URL.
 */

interface Resource {
  title: string
  url: string
}

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
  reading_minutes: number | null
  actions: string[]
  resources: Resource[]
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

          {/* The one action this page is for: the original. */}
          <a
            href={byte.url}
            target="_blank"
            rel="noopener noreferrer"
            className="press mt-5 inline-flex items-center gap-2 h-9 px-4 rounded-full bg-saffron text-parchment text-footnote font-medium hover:bg-saffron/90 transition-colors pointer-coarse:h-11"
          >
            {byte.source === 'video' ? 'Watch' : 'Read'} on {publisher}
            <Icon icon={ArrowSquareOut} size="sm" />
          </a>

          {/* Labelled, always: a machine-written paragraph must never pass for
              the publisher's words. */}
          {byte.summary && (
            <section aria-labelledby="byte-summary" className="mt-8">
              <h2 id="byte-summary" className="flex items-center gap-1.5 text-meta text-ink-muted mb-2">
                <Icon icon={Sparkle} size="sm" />
                The gist · AI-drafted
              </h2>
              <p className="text-body leading-relaxed text-ink">{byte.summary}</p>
            </section>
          )}

          {/* The human voice. This is what makes a digest get read. */}
          {byte.editor_note && (
            <p className="text-footnote text-ink mt-5 pl-3 border-l-2 border-saffron/40">
              {byte.editor_note}
            </p>
          )}

          {byte.actions.length > 0 && (
            <section aria-labelledby="byte-actions" className="mt-8 rounded-(--radius-card) border border-border bg-paper/60 p-5">
              <h2 id="byte-actions" className="flex items-center gap-1.5 text-footnote font-semibold text-ink">
                <Icon icon={Lightning} size="sm" />
                Try this
                <span className="font-normal text-meta text-ink-muted">· AI-suggested</span>
              </h2>
              <ol className="mt-3 space-y-2.5">
                {byte.actions.map((action, i) => (
                  <li key={i} className="flex gap-3 text-footnote leading-relaxed text-ink-soft">
                    <span className="mt-px flex size-5 shrink-0 items-center justify-center rounded-full bg-kinu font-mono text-[10px] text-ink-muted">
                      {i + 1}
                    </span>
                    {action}
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* The original first, then the links the publisher put in it. */}
          <section aria-labelledby="byte-resources" className="mt-8">
            <h2 id="byte-resources" className="text-footnote font-semibold text-ink mb-2">Resources</h2>
            <ul className="divide-y divide-border border-y border-border">
              {[{ title: byte.source_title, url: byte.url, original: true }, ...byte.resources.map(r => ({ ...r, original: false }))].map(r => (
                <li key={r.url}>
                  <a
                    href={r.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="press group flex items-center gap-3 py-3 hover:bg-kinu/30 transition-colors"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-footnote text-ink group-hover:text-saffron transition-colors">
                        {r.original ? `The original on ${publisher}` : r.title}
                      </span>
                      <span className="block truncate text-meta text-ink-muted">{hostOf(r.url)}</span>
                    </span>
                    <Icon icon={ArrowSquareOut} size="sm" className="shrink-0 text-ink-muted" />
                  </a>
                </li>
              ))}
            </ul>
          </section>

          <footer className="mt-10 pt-6 border-t border-border flex flex-wrap items-center gap-3">
            <InterestButton
              byteId={byte.id}
              initialCount={byte.interest_count}
              initialInterested={!!byte.user_interested}
              layout="wide"
            />
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

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
