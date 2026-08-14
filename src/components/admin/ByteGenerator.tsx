'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Textarea, Label } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { useToast } from '@/hooks/useToast'

const SUMMARY_MAX = 400
const NOTE_MAX = 300

interface AdminByte {
  id: string
  source: string
  source_title: string
  url: string
  source_points: number | null
  summary: string | null
  editor_note: string | null
  interest_count: number
  seeded_topic_id: string | null
  position: number
}

interface AdminDigest {
  id: string
  label: string
  status: 'draft' | 'published'
  published_at: string | null
}

export function ByteGenerator() {
  const toast = useToast()
  const [digest, setDigest] = useState<AdminDigest | null>(null)
  const [bytes, setBytes] = useState<AdminByte[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [publishing, setPublishing] = useState(false)

  const load = useCallback(async () => {
    try {
      const data = await fetch('/api/admin/bytes').then(r => r.json())
      setDigest(data.digest ?? null)
      setBytes(Array.isArray(data.bytes) ? data.bytes : [])
    } catch { /* non-critical */ } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const generate = async () => {
    setGenerating(true)
    try {
      const res = await fetch('/api/admin/bytes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) { toast(data.error || 'Generation failed', 'error'); return }

      toast(
        data.llm_available
          ? `Drafted ${data.count} bytes (${data.summarized} summarized)`
          : `Drafted ${data.count} bytes — no API key, write summaries by hand`,
        'success',
      )
      await load()
    } catch {
      toast('Generation failed', 'error')
    } finally {
      setGenerating(false)
    }
  }

  const saveField = async (byteId: string, field: 'summary' | 'editor_note', value: string) => {
    const res = await fetch('/api/admin/bytes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ byte_id: byteId, [field]: value }),
    })
    if (!res.ok) toast('Could not save', 'error')
  }

  const removeByte = async (byteId: string) => {
    const res = await fetch('/api/admin/bytes', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ byte_id: byteId }),
    })
    if (!res.ok) { toast('Could not delete', 'error'); return }
    setBytes(prev => prev.filter(b => b.id !== byteId))
  }

  const seedTopic = async (byteId: string) => {
    const res = await fetch('/api/admin/bytes/seed-topic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ byte_id: byteId }),
    })
    const data = await res.json()
    if (!res.ok) { toast(data.error || 'Could not seed topic', 'error'); return }
    toast('On the board 🎉', 'success')
    await load()
  }

  const publish = async () => {
    if (!digest) return
    setPublishing(true)
    try {
      const res = await fetch('/api/admin/bytes', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ digest_id: digest.id, publish: true }),
      })
      const data = await res.json()
      if (!res.ok) { toast(data.error || 'Could not publish', 'error'); return }
      toast('Published — everyone notified 📡', 'success')
      await load()
    } finally {
      setPublishing(false)
    }
  }

  const isDraft = digest?.status === 'draft'
  const notesWritten = bytes.filter(b => b.editor_note?.trim()).length

  return (
    <section className="bg-paper/50 border border-border rounded-xl p-4 md:p-5">
      <div className="flex items-start justify-between gap-3 mb-4 flex-wrap">
        <div className="min-w-0">
          <h2 className="text-[15px] font-semibold text-ink">Bytes</h2>
          <p className="text-[12px] text-cha mt-0.5 leading-relaxed">
            Pulls real stories from Hacker News, dev.to and GitHub. Summaries are AI-drafted —
            review them, add your own take, then publish.
          </p>
        </div>
        <Button size="sm" onClick={generate} disabled={generating}>
          {generating ? 'Fetching…' : digest && isDraft ? 'Regenerate' : 'Generate digest'}
        </Button>
      </div>

      {loading ? (
        <p className="text-[12px] text-cha">Loading…</p>
      ) : !digest ? (
        <p className="text-[12px] text-cha">No digest yet. Generate one before the meeting.</p>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="text-[13px] font-medium text-ink">{digest.label}</span>
            <Badge tone={isDraft ? 'neutral' : 'matcha'}>
              {isDraft ? 'Draft' : 'Published'}
            </Badge>
            <span className="text-[11px] text-cha">{bytes.length} items</span>
            {isDraft && (
              <span className={`text-[11px] ${notesWritten >= 2 ? 'text-matcha' : 'text-saffron'}`}>
                {notesWritten}/2 of your own notes
              </span>
            )}
          </div>

          <div className="space-y-3">
            {bytes.map(b => (
              <div key={b.id} className="border border-border rounded-lg p-3">
                <div className="flex items-start gap-2 mb-2">
                  <div className="min-w-0 flex-1">
                    <a
                      href={b.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-[13px] font-medium text-ink hover:text-saffron transition-colors"
                    >
                      {b.source_title}
                    </a>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <span className="text-[11px] text-cha">{b.source}</span>
                      {b.source_points ? (
                        <span className="text-[11px] text-cha tabular-nums">▲ {b.source_points}</span>
                      ) : null}
                      {b.interest_count > 0 && (
                        <span className="text-[11px] text-saffron">💬 {b.interest_count} interested</span>
                      )}
                      {b.seeded_topic_id && <Badge tone="saffron">★ Seeded</Badge>}
                    </div>
                  </div>
                  {isDraft && (
                    <Button size="sm" variant="ghost" onClick={() => removeByte(b.id)}>
                      Drop
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  <div>
                    <Label htmlFor={`sum-${b.id}`}>
                      Summary <span className="font-normal normal-case tracking-normal text-cha">(AI draft — edit freely)</span>
                    </Label>
                    <Textarea
                      id={`sum-${b.id}`}
                      defaultValue={b.summary ?? ''}
                      maxLength={SUMMARY_MAX}
                      rows={3}
                      disabled={!isDraft}
                      onBlur={e => saveField(b.id, 'summary', e.target.value)}
                      placeholder="What is this and why should the guild care?"
                    />
                  </div>
                  <div>
                    <Label htmlFor={`note-${b.id}`}>
                      Your take <span className="font-normal normal-case tracking-normal text-cha">(this is what gets read)</span>
                    </Label>
                    <Textarea
                      id={`note-${b.id}`}
                      defaultValue={b.editor_note ?? ''}
                      maxLength={NOTE_MAX}
                      rows={2}
                      disabled={!isDraft}
                      onBlur={e => saveField(b.id, 'editor_note', e.target.value)}
                      placeholder="e.g. this changes how we'd do our auth flow"
                    />
                  </div>
                </div>

                {/* Funnel — available after publish, ranked by interest taps. */}
                {!isDraft && !b.seeded_topic_id && (
                  <div className="mt-2.5">
                    <Button size="sm" variant="secondary" onClick={() => seedTopic(b.id)}>
                      Put on board
                    </Button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {isDraft && (
            <div className="mt-4 flex items-center gap-3 flex-wrap">
              <Button onClick={publish} disabled={publishing || bytes.length === 0}>
                {publishing ? 'Publishing…' : 'Publish & notify'}
              </Button>
              <span className="text-[11px] text-cha">
                Everyone gets one push. Best sent mid-cycle, when the board is quiet.
              </span>
            </div>
          )}
        </>
      )}
    </section>
  )
}
