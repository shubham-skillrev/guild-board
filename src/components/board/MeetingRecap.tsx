'use client'

import { useEffect, useState } from 'react'
import { CaretDown, DownloadSimple } from '@phosphor-icons/react/dist/ssr'
import { Icon } from '@/components/ui/Icon'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils/cn'
import type { MeetingRecap as Recap } from '@/lib/meet/report'

/** Open or folded, remembered on this device for every month. */
const FOLD_KEY = 'gb-meeting-recap-folded'

/**
 * "How the meeting went": above a past month's discussions on the board,
 * once that month's meeting has run (GET /api/meet/recap). Who joined, a
 * poll's top answer and a cloud's top words, the Boss Round's % right per
 * stage, and the rating. Counts only: the post-meeting report, cut down.
 * Collapsible (remembered locally). Admins get the report image to download.
 * Quiet on purpose: 13 px, no accent colour (the month tab carries it).
 */
export function MeetingRecap({ cycleId, label }: { cycleId: string; label: string }) {
  const { isAdmin } = useAuth()
  const [recap, setRecap] = useState<{ id: string; data: Recap | null } | null>(null)
  const [folded, setFolded] = useState(false)

  useEffect(() => {
    const id = setTimeout(() => {
      try { setFolded(localStorage.getItem(FOLD_KEY) === '1') } catch {}
    }, 0)
    return () => clearTimeout(id)
  }, [])

  useEffect(() => {
    let on = true
    fetch(`/api/meet/recap?cycle_id=${encodeURIComponent(cycleId)}`)
      .then(r => (r.ok ? r.json() : { recap: null }))
      .then(d => { if (on) setRecap({ id: cycleId, data: d.recap ?? null }) })
      .catch(() => { if (on) setRecap({ id: cycleId, data: null }) })
    return () => { on = false }
  }, [cycleId])

  const r = recap?.id === cycleId ? recap.data : null
  if (!r) return null

  const toggle = () => {
    setFolded(f => {
      try { localStorage.setItem(FOLD_KEY, f ? '0' : '1') } catch {}
      return !f
    })
  }
  const slug = label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'meeting'
  const people = `${r.people.total} joined`

  return (
    <section aria-label={`How the ${label} meeting went`} className="mb-4 overflow-hidden rounded-(--radius-card) border border-border bg-paper/50">
      <button type="button" onClick={toggle} aria-expanded={!folded} className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-kinu/30">
        <span className="text-[13px] font-semibold text-ink">How the meeting went</span>
        <span className="text-[11px] text-cha tabular-nums">{[r.date, people].filter(Boolean).join(' · ')}</span>
        <Icon icon={CaretDown} size="sm" className={cn('ml-auto shrink-0 text-cha transition-transform duration-200', !folded && 'rotate-180')} />
      </button>

      {!folded && (
        <div className="space-y-3 px-4 pb-4">
          <dl className="flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
            <Stat label="Joined" value={`${r.people.total}`} note={`${r.people.members} ${r.people.members === 1 ? 'member' : 'members'} · ${r.people.guests} ${r.people.guests === 1 ? 'guest' : 'guests'}`} />
            {r.rating && <Stat label="Rated" value={`${r.rating.pct}%`} note={r.rating.top} />}
          </dl>

          {r.highlights.length > 0 && (
            <ul className="space-y-2">
              {r.highlights.map((h, i) => (
                <li key={i} className="text-[13px] leading-snug">
                  <p className="text-ink-soft">{h.prompt}</p>
                  {h.kind === 'poll' ? (
                    <p className="mt-0.5 text-ink">
                      {h.top} <span className="tabular text-cha">· {h.pct}% of {h.answered}</span>
                    </p>
                  ) : (
                    <p className="mt-1 flex flex-wrap gap-1.5">
                      {h.words.map(w => (
                        <span key={w} className="inline-flex h-6 items-center rounded-full bg-kinu/70 px-2.5 text-[12px] text-ink">{w}</span>
                      ))}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}

          {r.stages.length > 0 && (
            <div>
              <p className="text-[13px] text-ink-soft">Boss Round · % right</p>
              <ul className="mt-1.5 space-y-1.5">
                {r.stages.map(s => (
                  <li key={s.kind} className="flex items-center gap-3 text-[13px]">
                    <span className="w-36 shrink-0 truncate text-ink">{s.label}</span>
                    <span aria-hidden className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-fill">
                      {s.pct > 0 && <span className="block h-full rounded-full bg-matcha/70" style={{ width: `${Math.min(100, s.pct)}%` }} />}
                    </span>
                    <span className="w-24 shrink-0 text-right tabular text-ink">
                      {s.pct}% <span className="text-cha">of {s.answered}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {isAdmin && (
            <a
              href={`/api/admin/meeting/report/image?cycle_id=${encodeURIComponent(cycleId)}`}
              download={`guild-meeting-${slug}.png`}
              className="press inline-flex h-8 items-center gap-1.5 rounded-full bg-kinu/70 px-3 text-[13px] font-medium text-ink-soft hover:bg-kinu hover:text-ink"
            >
              <Icon icon={DownloadSimple} size="sm" />
              Download image
            </a>
          )}
        </div>
      )}
    </section>
  )
}

function Stat({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-cha">{label}</dt>
      <dd className="text-ink">
        <span className="font-semibold tabular">{value}</span> <span className="text-ink-soft">{note}</span>
      </dd>
    </div>
  )
}
