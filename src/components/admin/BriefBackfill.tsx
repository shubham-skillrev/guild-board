'use client'

import { useEffect, useState } from 'react'
import { Sparkle } from '@phosphor-icons/react/dist/ssr'
import { Button } from '@/components/ui/Button'
import { useToast } from '@/hooks/useToast'

/**
 * Older bytes still carry a one-line summary. Each click turns the next
 * dozen into briefs (a fuller summary, "try this" lines, and the links from
 * the original); the daily job also does a dozen on its own.
 */
export function BriefBackfill() {
  const toast = useToast()
  const [left, setLeft] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    fetch('/api/admin/bytes/briefs').then(r => (r.ok ? r.json() : null)).then(d => d && setLeft(d.left)).catch(() => {})
  }, [])

  if (left === 0) return <p className="text-footnote text-ink-muted">Every byte is a brief.</p>

  const run = async () => {
    setBusy(true)
    try {
      const res = await fetch('/api/admin/bytes/briefs', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not rewrite them')
      setLeft(data.left)
      toast(data.converted ? `Rewrote ${data.converted}. ${data.left} to go.` : 'Kers couldn’t write any just now (AI busy). Try again in a minute.', data.converted ? 'success' : 'info')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not rewrite them', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-(--radius-card) border border-border p-4">
      <p className="min-w-0 flex-1 text-footnote text-ink-soft">
        {left == null ? 'Checking older bytes…' : `${left} older byte${left === 1 ? '' : 's'} still have a one-line summary.`}
      </p>
      <Button variant="secondary" icon={Sparkle} disabled={busy || !left} onClick={run}>
        {busy ? 'Kers is writing…' : 'Rewrite the next 12 as briefs'}
      </Button>
    </div>
  )
}
