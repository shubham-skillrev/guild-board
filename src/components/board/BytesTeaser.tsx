'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { SectionHeader } from '@/components/ui/Section'

interface TeaserByte {
  id: string
  source_title: string
  interest_count: number
}

/**
 * Compact pointer to the week's digest.
 *
 * The board is the page people land on, and Bytes is the thing that gives them
 * a reason to return between meetings, so the two need to be connected. Shows
 * nothing at all when there is no digest, rather than an empty shell.
 */
export function BytesTeaser() {
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
        hint={label}
        href="/bytes"
        hrefLabel="Read all"
      />
      <ul className="rounded-2xl border border-border bg-paper/40 divide-y divide-border overflow-hidden">
        {items.map(b => (
          <li key={b.id}>
            <Link
              href="/bytes"
              className="flex items-center gap-3 px-4 py-3 hover:bg-kinu/30 transition-colors press"
            >
              <span className="type-body text-ink truncate flex-1 min-w-0">{b.source_title}</span>
              {b.interest_count > 0 && (
                <span className="type-caption text-saffron shrink-0 tabular">
                  💬 {b.interest_count}
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
