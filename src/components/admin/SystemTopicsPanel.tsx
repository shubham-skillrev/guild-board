'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkle } from '@phosphor-icons/react/dist/ssr'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { SectionHeader } from '@/components/ui/Section'
import { useToast } from '@/hooks/useToast'
import { CATEGORY_LABELS, CATEGORY_TONE } from '@/lib/constants'
import { cn } from '@/lib/utils/cn'

interface Draft {
  kind: string
  title: string
  why: string
  sources: { name: string; url: string }[]
}

/**
 * Ask GuildBot for suggestions now, instead of waiting for the monthly job.
 *
 * Two steps on purpose: Gemini's picks are shown first, with their sources,
 * and only the ones left ticked are posted. Posting puts them on the board as
 * GuildBot and sends one Slack message listing every topic with its link.
 */
export function SystemTopicsPanel() {
  const router = useRouter()
  const toast = useToast()
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [picked, setPicked] = useState<Set<number>>(new Set())
  const [busy, setBusy] = useState<'preview' | 'post' | null>(null)

  const call = async (payload: Record<string, unknown>) => {
    const res = await fetch('/api/admin/system-topics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error ?? 'Something went wrong')
    return data
  }

  const preview = async () => {
    setBusy('preview')
    try {
      const data = await call({ action: 'preview' })
      setDrafts(data.drafts)
      setPicked(new Set(data.drafts.map((_: Draft, i: number) => i)))
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not get suggestions', 'error')
    } finally {
      setBusy(null)
    }
  }

  const post = async () => {
    const chosen = drafts.filter((_, i) => picked.has(i))
    if (!chosen.length) return
    setBusy('post')
    try {
      const data = await call({ action: 'post', drafts: chosen })
      toast(
        data.posted
          ? `Posted ${data.posted} ${data.posted === 1 ? 'topic' : 'topics'} and told Slack`
          : 'Those are already on the board',
        data.posted ? 'success' : 'info',
      )
      setDrafts([])
      setPicked(new Set())
      router.refresh()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not post', 'error')
    } finally {
      setBusy(null)
    }
  }

  const toggle = (i: number) =>
    setPicked(prev => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i); else next.add(i)
      return next
    })

  return (
    <section aria-labelledby="admin-suggest" className="mt-(--gap-section)">
      <SectionHeader id="admin-suggest" title="GuildBot suggestions" hint="from this week's tech news" />
      <div className="rounded-(--radius-card) border border-border bg-paper p-(--pad-card)">
        {drafts.length === 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-[13px] text-ink-soft max-w-md">
              Gemini reads this week&apos;s AI and engineering news and suggests 3 to 5 topics. You
              review them before anything is posted.
            </p>
            <Button icon={Sparkle} onClick={preview} disabled={busy !== null}>
              {busy === 'preview' ? 'Reading the news…' : 'Suggest topics'}
            </Button>
          </div>
        ) : (
          <>
            <ul className="space-y-3">
              {drafts.map((d, i) => {
                const on = picked.has(i)
                return (
                  <li key={d.title}>
                    <label
                      className={cn(
                        'flex gap-3 rounded-(--radius-control) border p-3 cursor-pointer transition-colors',
                        on ? 'border-border-strong bg-sumi/60' : 'border-border opacity-60',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={() => toggle(i)}
                        className="mt-1 accent-(--color-ink)"
                        aria-label={`Include "${d.title}"`}
                      />
                      <span className="min-w-0">
                        <Badge tone={CATEGORY_TONE[d.kind] ?? 'neutral'} dot>{CATEGORY_LABELS[d.kind] ?? d.kind}</Badge>
                        <span className="mt-1.5 block text-[14px] font-semibold text-ink leading-snug">{d.title}</span>
                        <span className="mt-1 block text-[13px] text-ink-soft leading-relaxed">{d.why}</span>
                        {d.sources.length > 0 && (
                          <span className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[12px]">
                            {d.sources.map(s => (
                              <a
                                key={s.url}
                                href={s.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="text-cha underline decoration-border-strong underline-offset-2 hover:text-ink"
                              >
                                {s.name} ↗
                              </a>
                            ))}
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                )
              })}
            </ul>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
              <p className="text-[12px] text-cha">Posts as GuildBot and sends one Slack message with every link.</p>
              <div className="flex items-center gap-2">
                <Button variant="ghost" onClick={preview} disabled={busy !== null}>
                  {busy === 'preview' ? 'Reading…' : 'Try again'}
                </Button>
                <Button onClick={post} disabled={busy !== null || picked.size === 0}>
                  {busy === 'post' ? 'Posting…' : `Post ${picked.size} to the board`}
                </Button>
              </div>
            </div>
          </>
        )}
      </div>
    </section>
  )
}
