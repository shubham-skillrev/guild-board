'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { OverflowMenu } from '@/components/ui/OverflowMenu'
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

  const generate = async (mode: 'fresh' | 'monthly' = 'fresh') => {
    setGenerating(true)
    try {
      const res = await fetch('/api/admin/bytes/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode }),
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
    <section>
      <SectionHeader
        title="Bytes"
        hint="Autopilot: 10 stories ~15 days before the meeting, 10 more ~3 days before"
        action={
          <OverflowMenu
            label="More Bytes actions"
            items={[
              // The same look-back the 1st-of-the-month job builds. A separate
              // action, not a mode toggle: the two produce different digests.
              { label: 'Rebuild top of the month', onSelect: () => generate('monthly'), disabled: generating },
              ...(digest ? [{ label: isLive ? 'Hide from the guild' : 'Make visible again', onSelect: toggleHidden }] : []),
            ]}
          />
        }
      />

      <div className="p-(--pad-card) bg-paper border border-border rounded-(--radius-card) space-y-3">
        {loading ? (
          <p className="text-footnote text-cha">Loading…</p>
        ) : !digest ? (
          <p className="text-footnote text-cha">No digest yet. Autopilot publishes one, or fetch now.</p>
        ) : (
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-footnote text-ink">{digest.label}</span>
            <Badge tone={isLive ? 'matcha' : 'neutral'} dot>{isLive ? 'Live' : 'Hidden'}</Badge>
            <span className="text-caption text-cha tabular">{bytes.length} stories</span>
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          <Button size="sm" variant="tinted" onClick={() => generate('fresh')} disabled={generating}>
            {generating ? 'Fetching…' : 'Fetch more now'}
          </Button>
          {/* Curating story by story is the Bytes page's job; this panel keeps
              only the state and the controls. */}
          <a href="/bytes" className="text-caption text-saffron hover:underline">Edit stories</a>
        </div>
        <p className="text-caption text-cha">Fetching notifies the guild.</p>
      </div>
    </section>
  )
}
