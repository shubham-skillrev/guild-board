'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { SectionHeader } from '@/components/ui/Section'
import { useUnseenDigest } from '@/lib/bytes/useUnseenDigest'
import { mediumLabel, hasReaderPage } from '@/lib/bytes/labels'

interface TeaserByte {
  id: string
  source_title: string
  source_name?: string | null
  summary: string | null
  url: string
  source: string
  interest_count: number
  reading_minutes?: number | null
}

/**
 * Compact pointer to the latest drop.
 *
 * The board is the page people land on, and Bytes is the thing that gives them
 * a reason to return between meetings, so the two need to be connected. Shows
 * nothing at all when there is no digest, rather than an empty shell.
 *
 * Reads `current` - the newest digest, in published order. It used to read
 * `[...top, ...bytes]`, which meant Top filled all three slots, and Top is
 * ranked across a window of past digests: the board sat on the same three
 * rows for weeks while fresh digests published behind it. "Fresh bytes" has to
 * be fresh, so the teaser now takes the newest digest and only the newest.
 */
export function BytesTeaser() {
  const { unseen } = useUnseenDigest()
  const [label, setLabel] = useState<string | null>(null)
  const [items, setItems] = useState<TeaserByte[]>([])

  useEffect(() => {
    let cancelled = false

    // no-store: a digest that landed this morning must not be hidden behind a
    // response the browser cached before dawn.
    fetch('/api/bytes', { cache: 'no-store' })
      .then(r => r.json())
      .then(data => {
        if (cancelled || !data?.digest) return
        setLabel(data.digest.label)
        setItems((data.current ?? data.bytes ?? []).slice(0, 3))
      })
      .catch(() => {})

    return () => {
      cancelled = true
    }
  }, [])

  if (!label || items.length === 0) return null

  return (
    <section aria-labelledby="board-bytes">
      <SectionHeader
        id="board-bytes"
        title="Fresh bytes"
        /* Mobile has no Bytes tab, so the board is where a new digest has to
           announce itself on a phone. */
        hint={unseen ? `New · ${label}` : label}
        href="/bytes"
        hrefLabel="Read all"
      />
      <ul className="rounded-(--radius-card) border border-border bg-paper/40 divide-y divide-border overflow-hidden">
        {items.map(b => (
          <li key={b.id}>
            {/* Straight into the reader when the feed syndicated the piece,
                straight to the publisher when it did not. Neither drops you at
                the top of /bytes to find the row you just tapped. */}
            <Link
              href={hasReaderPage(b) ? `/bytes/${b.id}` : b.url}
              target={hasReaderPage(b) ? undefined : '_blank'}
              rel={hasReaderPage(b) ? undefined : 'noopener noreferrer'}
              className="block px-4 py-3 hover:bg-kinu/30 transition-colors"
            >
              <div className="flex items-start gap-2">
                <span className="text-footnote text-ink flex-1 min-w-0 line-clamp-2">
                  {b.source_title}
                </span>
                {b.interest_count > 0 && (
                  <span className="text-meta text-saffron shrink-0 tabular pt-0.5">
                    {b.interest_count}
                  </span>
                )}
              </div>
              {/* The summary is the part that tells you whether it is worth
                  opening. One line here; the row is a pointer, not the digest. */}
              {b.summary && (
                <p className="text-meta text-ink-muted mt-1 line-clamp-1">{b.summary}</p>
              )}
              <p className="text-meta text-cha mt-1">
                {[mediumLabel(b.source), b.source_name].filter(Boolean).join(' · ')}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
