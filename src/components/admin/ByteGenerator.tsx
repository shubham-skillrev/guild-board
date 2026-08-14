'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Textarea, Label } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { SectionHeader } from '@/components/ui/Section'
import { DOMAIN_ICONS, DOMAIN_LABELS, type Domain } from '@/lib/bytes/domains'
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
  domain: string | null
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

/**
 * Curation panel for the live digest.
 *
 * There is no review-then-publish flow: the weekly job publishes on its own
 * schedule and this edits what is already live. Summaries and notes are
 * optional, because a story's title and link are useful on their own and
 * blocking the whole digest on prose nobody has written yet just means the
 * digest never ships.
 */
export function ByteGenerator() {
  const toast = useToast()
  const [digest, setDigest] = useState<AdminDigest | null>(null)
  const [bytes, setBytes] = useState<AdminByte[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

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
          ? `${data.count} stories in, ${data.summarized} summarized`
          : `${data.count} stories in. No API key, so summaries are blank`,
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
    if (!res.ok) { toast('Could not remove', 'error'); return }
    setBytes(prev => prev.filter(b => b.id !== byteId))
    toast('Removed from the digest', 'info')
  }

  const seedTopic = async (byteId: string) => {
    const res = await fetch('/api/admin/bytes/seed-topic', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ byte_id: byteId }),
    })
    const data = await res.json()
    if (!res.ok) { toast(data.error || 'Could not put it on the board', 'error'); return }
    toast('On the board 🎉', 'success')
    await load()
  }

  const toggleHidden = async () => {
    if (!digest) return
    const hide = digest.status === 'published'
    const res = await fetch('/api/admin/bytes', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ digest_id: digest.id, hidden: hide }),
    })
    if (!res.ok) { toast('Could not update', 'error'); return }
    toast(hide ? 'Hidden from the guild' : 'Visible again', 'info')
    await load()
  }

  const isLive = digest?.status === 'published'
  // Sorted so the stories people actually want are easiest to act on.
  const sorted = [...bytes].sort(
    (a, b) => b.interest_count - a.interest_count || a.position - b.position,
  )

  return (
    <section className="rounded-2xl border border-border bg-paper/40 p-4 md:p-5">
      <SectionHeader
        title="Bytes"
        hint="fetched every Monday, live on arrival"
        href="/bytes"
        hrefLabel="View"
      />

      <p className="type-body text-cha mb-4 -mt-1">
        Stories come from Hacker News, Lobsters, dev.to and GitHub. Titles and links are
        verbatim from those feeds. Summaries are AI-drafted and optional, so edit what is
        worth editing and leave the rest.
      </p>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Button size="sm" onClick={generate} disabled={generating}>
          {generating ? 'Fetching…' : 'Fetch more now'}
        </Button>
        {digest && (
          <Button size="sm" variant="secondary" onClick={toggleHidden}>
            {isLive ? 'Hide from guild' : 'Make visible'}
          </Button>
        )}
      </div>

      {loading ? (
        <p className="type-body text-cha">Loading…</p>
      ) : !digest ? (
        <p className="type-body text-cha">
          No digest yet. The Monday job creates one automatically, or fetch now.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="type-title text-ink">{digest.label}</span>
            <Badge tone={isLive ? 'matcha' : 'neutral'}>{isLive ? 'Live' : 'Hidden'}</Badge>
            <span className="type-caption text-cha tabular">{bytes.length} stories</span>
          </div>

          <ul className="space-y-2.5">
            {sorted.map(b => {
              const domain = b.domain as Domain | null
              const isOpen = expanded === b.id
              return (
                <li key={b.id} className="rounded-xl border border-border bg-sumi/40 overflow-hidden">
                  <div className="flex items-start gap-2 p-3">
                    <div className="min-w-0 flex-1">
                      <a
                        href={b.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="type-body text-ink hover:text-saffron transition-colors font-medium press"
                      >
                        {b.source_title}
                      </a>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        {domain && DOMAIN_LABELS[domain] && (
                          <span className="type-caption text-ink-soft">
                            {DOMAIN_ICONS[domain]} {DOMAIN_LABELS[domain]}
                          </span>
                        )}
                        <span className="type-caption text-cha">{b.source}</span>
                        {b.source_points ? (
                          <span className="type-caption text-cha tabular">
                            ▲ {b.source_points.toLocaleString()}
                          </span>
                        ) : null}
                        {b.interest_count > 0 && (
                          <span className="type-caption text-saffron tabular">
                            💬 {b.interest_count} want to discuss
                          </span>
                        )}
                        {!b.summary && (
                          <span className="type-caption text-cha">no summary</span>
                        )}
                        {b.seeded_topic_id && <Badge tone="saffron">★ On the board</Badge>}
                        {b.editor_note && <Badge tone="wisteria">Your take</Badge>}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setExpanded(isOpen ? null : b.id)}
                      aria-expanded={isOpen}
                      className="press-sm type-caption text-cha hover:text-ink shrink-0 px-2 py-1 rounded-md hover:bg-kinu"
                    >
                      {isOpen ? 'Done' : 'Edit'}
                    </button>
                  </div>

                  {isOpen && (
                    <div className="px-3 pb-3 space-y-2.5 border-t border-border pt-3">
                      <div>
                        <Label htmlFor={`sum-${b.id}`}>Summary</Label>
                        <Textarea
                          id={`sum-${b.id}`}
                          defaultValue={b.summary ?? ''}
                          maxLength={SUMMARY_MAX}
                          rows={3}
                          onBlur={e => saveField(b.id, 'summary', e.target.value)}
                          placeholder="Optional. What is this and why should the guild care?"
                        />
                      </div>
                      <div>
                        <Label htmlFor={`note-${b.id}`}>
                          Your take{' '}
                          <span className="font-normal normal-case tracking-normal text-cha">
                            (this is the part people read)
                          </span>
                        </Label>
                        <Textarea
                          id={`note-${b.id}`}
                          defaultValue={b.editor_note ?? ''}
                          maxLength={NOTE_MAX}
                          rows={2}
                          onBlur={e => saveField(b.id, 'editor_note', e.target.value)}
                          placeholder="e.g. this changes how we'd do our auth flow"
                        />
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {!b.seeded_topic_id && (
                          <Button size="sm" variant="secondary" onClick={() => seedTopic(b.id)}>
                            Put on board
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="ml-auto"
                          onClick={() => removeByte(b.id)}
                        >
                          Remove
                        </Button>
                      </div>
                    </div>
                  )}
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}
