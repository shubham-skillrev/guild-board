'use client'

import { useEffect, useState } from 'react'
import { ByteCard, type Byte } from '@/components/bytes/ByteCard'

interface Digest {
  id: string
  label: string
  published_at: string | null
}

export default function BytesPage() {
  const [digest, setDigest] = useState<Digest | null>(null)
  const [bytes, setBytes] = useState<Byte[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/bytes')
      .then(r => r.json())
      .then(data => {
        setDigest(data.digest ?? null)
        setBytes(Array.isArray(data.bytes) ? data.bytes : [])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="px-5 md:px-10 py-8 w-full max-w-3xl mx-auto pb-28 md:pb-8">
      <div className="mb-6">
        <h1 className="font-serif text-2xl font-bold text-ink tracking-tight">Bytes</h1>
        <p className="text-[13px] text-ink-soft mt-1 leading-relaxed">
          {digest
            ? `${digest.label} — what happened since the last meeting.`
            : 'What happened in tech since the last meeting.'}
        </p>
      </div>

      {loading ? (
        <div className="text-center py-16 text-[13px] text-cha">Loading…</div>
      ) : !digest || bytes.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-3xl mb-3">📡</div>
          <p className="text-base font-medium text-ink-soft">No bytes yet</p>
          <p className="text-[13px] mt-1 text-cha max-w-sm mx-auto leading-relaxed">
            A short digest lands before each meeting. Tap “I’d discuss this” on anything
            you want on the board.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3 stagger-children">
            {bytes.map(b => (
              <ByteCard key={b.id} byte={b} />
            ))}
          </div>

          {/* Say plainly which parts a model wrote — with an engineering
              audience, unlabeled AI text is a credibility risk. */}
          <p className="text-[11px] text-cha mt-6 text-center leading-relaxed">
            Headlines and links come straight from Hacker News, dev.to and GitHub.
            <br />
            Summaries are AI-drafted and human-reviewed; the quoted notes are your admin’s own.
          </p>
        </>
      )}
    </div>
  )
}
