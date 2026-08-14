'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { SectionHeader } from '@/components/ui/Section'
import { useUnseenDigest } from '@/lib/bytes/useUnseenDigest'

interface TeaserByte {
  id: string
  source_title: string
  source_name?: string | null
  summary: string | null
  source: string
  interest_count: number
}

/** Format first, publisher second - same line the digest itself shows. */
const MEDIUM_LABELS: Record<string, string> = {
  blog: 'Article',
  hn: 'Article',
  news: 'News',
  video: 'Video',
  github: 'Repo',
  lobsters: 'Article',
  devto: 'Article',
}

/**
 * Compact pointer to the week's digest.
 *
 * The board is the page people land on, and Bytes is the thing that gives them
 * a reason to return between meetings, so the two need to be connected. Shows
 * nothing at all when there is no digest, rather than an empty shell.
 */
export function BytesTeaser() {
  const { unseen } = useUnseenDigest()
  const [label, setLabel] = useState<string | null>(null)
  const [items, setItems] = useState<TeaserByte[]>([])

  useEffect(() => {
    fetch('/api/bytes')
      .then(r => r.json())
      .then(data => {
        if (!data?.digest) return
        setLabel(data.digest.label)
        const all = [...(data.top ?? []), ...(data.bytes ?? [])]
        setItems(all.slice(0, 3))
      })
      .catch(() => {})
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
            {/* The teaser showed a truncated headline and nothing else, so it
                read as a list of links rather than as news. The summary is the
                part that tells you whether it is worth opening. */}
            <Link
              href="/bytes"
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
              {b.summary && (
                <p className="text-meta text-ink-muted mt-1 line-clamp-2">{b.summary}</p>
              )}
              <p className="text-meta text-cha mt-1">
                {[MEDIUM_LABELS[b.source] ?? b.source, b.source_name]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
