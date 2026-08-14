'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { SectionHeader } from '@/components/ui/Section'
import { useToast } from '@/hooks/useToast'


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
 * There is no review-then-publish flow: the scheduled job publishes on its own
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
      // The breakdown is worth surfacing: a run that came back with no video
      // or no news means a feed is failing, and a bare count hides that.
      const mix = data.mix
        ? ` (${data.mix.blog + data.mix.hn} read, ${data.mix.news} news, ${data.mix.video} video)`
        : ''
      toast(
        data.llm_available
          ? `${data.count} stories in${mix}, ${data.summarized} summarized`
          : `${data.count} stories in${mix}. No API key, so summaries are blank`,
        'success',
      )
      await load()
    } catch {
      toast('Generation failed', 'error')
    } finally {
      setGenerating(false)
    }
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

  return (
    <section className="rounded-(--radius-card) border border-border bg-paper/40 p-(--pad-card)">
      <SectionHeader
        title="Bytes"
        hint="fetched every other morning, live on arrival"
        href="/bytes"
        hrefLabel="View"
      />

      <p className="type-body text-cha mb-4 -mt-1">
        A mix of engineering blog posts, tech reporting and conference talks, with a
        little Hacker News. Titles, links and thumbnails are verbatim from those feeds.
        Summaries are AI-drafted and optional. Fetching notifies the guild.
      </p>

      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Button size="sm" variant="tinted" onClick={generate} disabled={generating}>
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
          No digest yet. The scheduled job creates one every other morning, or fetch now.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="type-title text-ink">{digest.label}</span>
            <Badge tone={isLive ? 'matcha' : 'neutral'}>{isLive ? 'Live' : 'Hidden'}</Badge>
            <span className="type-caption text-cha tabular">{bytes.length} stories</span>
          </div>

          {/* The full story list lived here. It is gone on purpose: curating a
              digest story by story is a job for the Bytes page itself, and
              reproducing every row inside the admin panel made this screen the
              longest in the product for an action nobody performs weekly.
              What stays is the state and the controls. */}
          <p className="text-footnote text-ink-muted">
            Edit individual stories on the{' '}
            <a href="/bytes" className="text-saffron hover:underline">Bytes page</a>.
          </p>
        </>
      )}
    </section>
  )
}
