'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { SectionHeader } from '@/components/ui/Section'
import { useToast } from '@/hooks/useToast'
import { CATEGORY_LABELS, CATEGORY_TONE } from '@/lib/constants'
import { sanitizeTheme, type CycleTheme } from '@/lib/themes'
import { ThemeEditor, isThemeComplete } from '@/components/admin/ThemeEditor'
import type { Cycle } from '@/types'

/**
 * The working cycle's theme, and the way to change it mid-month. A new month
 * picks its theme in the create form instead, so the month-open message can
 * carry it; this is for the month already running.
 */
export function ThemePanel({ cycle }: { cycle: Cycle | null }) {
  const router = useRouter()
  const toast = useToast()
  const current = sanitizeTheme(cycle?.theme)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<CycleTheme | null>(current)
  const [saving, setSaving] = useState(false)

  if (!cycle) return null
  const editable = cycle.status === 'open' || cycle.status === 'upcoming'

  const save = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/themes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', cycle_id: cycle.id, theme: draft }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not save')
      toast(draft ? `${cycle.label} is now "${draft.name}"` : `${cycle.label} has no theme`, 'success')
      setEditing(false)
      router.refresh()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save', 'error')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-labelledby="admin-theme" className="mt-(--gap-section)">
      <SectionHeader id="admin-theme" title="Month theme" hint={cycle.label} />
      <div className="rounded-(--radius-card) border border-border bg-paper p-(--pad-card)">
        {!editing ? (
          <div className="flex flex-wrap items-start justify-between gap-3">
            {current ? (
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[14px] font-semibold text-ink">{current.name}</span>
                  <Badge tone={CATEGORY_TONE[current.featured_kind] ?? 'neutral'} dot>
                    {CATEGORY_LABELS[current.featured_kind] ?? current.featured_kind}
                  </Badge>
                </div>
                <p className="mt-1 text-[13px] text-ink-soft">{current.title} · {current.subtitle}</p>
                <p className="mt-1 text-[12px] text-cha">Share button: {current.cta}</p>
              </div>
            ) : (
              <p className="text-[13px] text-ink-soft max-w-md">
                No theme. The board and landing page use neutral copy, and the share form opens on
                &quot;Learned&quot;.
              </p>
            )}
            {editable && (
              <Button variant="tinted" size="sm" onClick={() => { setDraft(current); setEditing(true) }}>
                {current ? 'Change theme' : 'Add a theme'}
              </Button>
            )}
          </div>
        ) : (
          <>
            <ThemeEditor monthLabel={cycle.label} value={draft} onChange={setDraft} />
            <div className="mt-4 flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
              <Button onClick={save} disabled={saving || !isThemeComplete(draft)}>
                {saving ? 'Saving…' : draft ? `Save theme for ${cycle.label}` : `Clear theme for ${cycle.label}`}
              </Button>
            </div>
            <p className="mt-2 text-right text-[12px] text-cha">
              Changes the board and landing page right away. Nobody is notified.
            </p>
          </>
        )}
      </div>
    </section>
  )
}
