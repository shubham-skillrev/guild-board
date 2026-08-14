'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'

const SOURCE_LABELS: Record<string, string> = {
  hn: 'Hacker News',
  devto: 'dev.to',
  github: 'GitHub',
}

const SOURCE_TONE = {
  hn: 'saffron',
  devto: 'wisteria',
  github: 'matcha',
} as const

export interface Byte {
  id: string
  source: keyof typeof SOURCE_TONE
  source_title: string
  url: string
  source_points: number | null
  summary: string | null
  tags: string[] | null
  editor_note: string | null
  interest_count: number
  seeded_topic_id: string | null
  user_interested?: boolean
}

export function ByteCard({ byte }: { byte: Byte }) {
  const [interested, setInterested] = useState(!!byte.user_interested)
  const [count, setCount] = useState(byte.interest_count)
  const [busy, setBusy] = useState(false)

  const toggle = async () => {
    if (busy) return
    setBusy(true)

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
    <Card className="p-4">
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <Badge tone={SOURCE_TONE[byte.source] ?? 'neutral'}>
          {SOURCE_LABELS[byte.source] ?? byte.source}
        </Badge>
        {byte.source_points ? (
          <span className="text-[11px] text-cha tabular-nums">▲ {byte.source_points}</span>
        ) : null}
        {byte.seeded_topic_id && <Badge tone="saffron">★ On the board</Badge>}
      </div>

      <a
        href={byte.url}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[15px] font-medium text-ink hover:text-saffron transition-colors leading-snug block"
      >
        {byte.source_title}
      </a>

      {byte.summary && (
        <p className="text-[13px] text-ink-soft mt-2 leading-relaxed">{byte.summary}</p>
      )}

      {/* The human voice — what makes a digest get read rather than muted. */}
      {byte.editor_note && (
        <p className="text-[13px] text-ink mt-2.5 pl-3 border-l-2 border-saffron/40 leading-relaxed">
          {byte.editor_note}
        </p>
      )}

      <div className="flex items-center gap-2 mt-3.5 flex-wrap">
        <button
          type="button"
          onClick={toggle}
          disabled={busy}
          aria-pressed={interested}
          className={cn(
            'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[12px] transition-all disabled:opacity-60',
            interested
              ? 'border-saffron/40 bg-saffron-light text-saffron'
              : 'border-border text-ink-soft hover:border-border-strong hover:bg-kinu/40',
          )}
        >
          <span>💬</span>
          <span>I&apos;d discuss this</span>
          {count > 0 && <span className="tabular-nums opacity-80">{count}</span>}
        </button>

        {byte.seeded_topic_id && (
          <a
            href={`/board/${byte.seeded_topic_id}`}
            className="text-[12px] text-saffron hover:underline"
          >
            View topic →
          </a>
        )}

        {byte.tags?.length ? (
          <span className="ml-auto flex gap-1 flex-wrap">
            {byte.tags.map(t => (
              <span key={t} className="text-[11px] text-cha">
                #{t}
              </span>
            ))}
          </span>
        ) : null}
      </div>
    </Card>
  )
}
