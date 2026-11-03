'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Play, Stop, Trash } from '@phosphor-icons/react/dist/ssr'
import { Kers } from '@/components/kers/Kers'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils/cn'
import { useMeeting } from '@/components/admin/run/useMeeting'
import { LIMITS, type Meeting } from '@/lib/meeting'

function clock(seconds: number): string {
  const s = Math.abs(Math.round(seconds))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/**
 * The meeting, live. One segment at a time with its countdown, the agenda
 * down the side, and a capture box for notes, decisions and owners that
 * feed the recap. Arrow keys move between segments (outside the inputs).
 */
export function MeetingMode({ label, initial }: { label: string; initial: Meeting }) {
  const { meeting, busy, call } = useMeeting(initial)
  const [idx, setIdx] = useState(0)
  const [segmentStart, setSegmentStart] = useState(() => Date.now())
  const [now, setNow] = useState(() => Date.now())
  const [text, setText] = useState('')
  const [owner, setOwner] = useState('')
  const [decision, setDecision] = useState(false)

  const live = !!meeting.startedAt && !meeting.endedAt
  const agenda = meeting.agenda
  const seg = agenda[idx]

  useEffect(() => {
    if (!live) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [live])

  const go = (to: number) => {
    if (to < 0 || to >= agenda.length) return
    setIdx(to)
    setSegmentStart(Date.now())
    setNow(Date.now())
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.closest('input, textarea, select')) return
      if (e.key === 'ArrowRight') go(idx + 1)
      if (e.key === 'ArrowLeft') go(idx - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  if (!agenda.length) {
    return (
      <div className="rounded-[20px] border border-dashed border-border-strong p-10 text-center">
        <p className="text-[17px] text-ink">No agenda yet.</p>
        <p className="mt-1 text-footnote text-ink-muted">Build one on the Run tab first, then come back here.</p>
        <Link href="/admin/run" className="mt-4 inline-block text-footnote text-ink underline underline-offset-2">Back to Run</Link>
      </div>
    )
  }

  const remaining = live ? seg.minutes * 60 - (now - segmentStart) / 1000 : seg.minutes * 60
  const over = remaining < 0
  const elapsedTotal = live && meeting.startedAt ? (now - new Date(meeting.startedAt).getTime()) / 1000 : 0

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim()) return
    const ok = await call('note', { note: { text, owner, decision, segment: seg.id } })
    if (ok) { setText(''); setOwner(''); setDecision(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/admin/run" className="inline-flex items-center gap-1 text-footnote text-ink-muted hover:text-ink"><Icon icon={ArrowLeft} size="sm" /> Run</Link>
        <p className="text-footnote text-ink-muted">{label} meeting{live ? ` · ${clock(elapsedTotal)} in` : meeting.endedAt ? ' · ended' : ''}</p>
        <div className="ml-auto flex gap-2">
          {!live && !meeting.endedAt && <Button icon={Play} disabled={!!busy} onClick={() => { call('start', {}, 'Meeting started'); go(0) }}>Start the meeting</Button>}
          {live && <Button variant="secondary" icon={Stop} disabled={!!busy} onClick={() => call('end', {}, 'Meeting ended: the recap is on the Run tab')}>End the meeting</Button>}
          {meeting.endedAt && <Link href="/admin/run#run-recap" className="press inline-flex h-8 items-center rounded-(--radius-control) bg-ink px-3 text-footnote font-medium text-parchment">Write the recap →</Link>}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] items-start">
        <div className="space-y-6 min-w-0">
          {/* The segment on now. */}
          <section aria-live="polite" className="relative overflow-hidden rounded-[24px] bg-ink p-6 text-parchment sm:p-8">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-parchment/60">
              {String(idx + 1).padStart(2, '0')} of {String(agenda.length).padStart(2, '0')} · {seg.minutes} min
            </p>
            <h2 className="mt-3 text-[28px] sm:text-[36px] font-semibold leading-tight tracking-[-0.03em]">{seg.title}</h2>
            {seg.detail && <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-parchment/80">{seg.detail}</p>}
            <p className={cn('mt-6 font-mono text-[44px] sm:text-[56px] leading-none tabular', over ? 'text-[#ff9a7a]' : 'text-parchment')}>
              {over ? '+' : ''}{clock(remaining)}
            </p>
            <p className="mt-1 text-meta text-parchment/60">{live ? (over ? 'over time' : 'left') : 'starts when you start the meeting'}</p>
            <Kers size={84} expression={over ? 'dramatic' : 'excited'} className="absolute bottom-4 right-4 max-sm:hidden" />
          </section>

          <div className="flex gap-2">
            <Button variant="secondary" icon={ArrowLeft} disabled={idx === 0} onClick={() => go(idx - 1)}>Back</Button>
            <Button variant="secondary" disabled={idx === agenda.length - 1} onClick={() => go(idx + 1)}>
              Next: {agenda[idx + 1]?.title ?? 'that’s it'} <Icon icon={ArrowRight} size="sm" />
            </Button>
          </div>

          {/* Capture. */}
          <form onSubmit={add} className="rounded-(--radius-card) border border-border bg-paper p-4 space-y-2.5">
            <p className="text-footnote font-medium text-ink">Capture</p>
            <Input aria-label="Note" placeholder="What was said or decided" maxLength={LIMITS.note} value={text} onChange={e => setText(e.target.value)} />
            <div className="flex flex-wrap items-center gap-2">
              <Input aria-label="Owner" placeholder="Owner (optional)" maxLength={LIMITS.owner} value={owner} onChange={e => setOwner(e.target.value)} className="max-w-[14rem]" />
              <label className="inline-flex items-center gap-2 text-footnote text-ink-soft cursor-pointer">
                <input type="checkbox" checked={decision} onChange={e => setDecision(e.target.checked)} className="size-4 accent-ink" /> Decision
              </label>
              <Button type="submit" variant="secondary" className="ml-auto" disabled={!text.trim() || busy === 'note'}>{busy === 'note' ? 'Adding…' : 'Add'}</Button>
            </div>
          </form>

          {meeting.notes.length > 0 && (
            <ul className="divide-y divide-border border-y border-border">
              {[...meeting.notes].reverse().map(n => (
                <li key={n.id} className="flex items-start gap-3 py-2.5 text-footnote">
                  <span className={cn('mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[11px]', n.decision ? 'bg-ink text-parchment' : 'bg-kinu text-ink-muted')}>
                    {n.decision ? 'Decision' : 'Note'}
                  </span>
                  <p className="min-w-0 flex-1 text-ink">
                    {n.text}
                    {n.owner && <span className="text-ink-muted"> · {n.owner}</span>}
                    <span className="block text-meta text-ink-muted">{agenda.find(s => s.id === n.segment)?.title ?? ''}</span>
                  </p>
                  <button type="button" aria-label="Delete note" onClick={() => call('delete_note', { id: n.id })} className="press-sm p-1 text-ink-muted hover:text-vermillion">
                    <Icon icon={Trash} size="sm" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* The running order. */}
        <ol className="rounded-(--radius-card) border border-border bg-paper p-2 lg:sticky lg:top-20">
          {agenda.map((s, i) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => go(i)}
                aria-current={i === idx ? 'step' : undefined}
                className={cn(
                  'flex w-full items-baseline gap-3 rounded-(--radius-control) px-3 py-2.5 text-left text-footnote transition-colors',
                  i === idx ? 'bg-ink text-parchment' : i < idx ? 'text-ink-muted hover:bg-kinu/50' : 'text-ink hover:bg-kinu/50',
                )}
              >
                <span className="font-mono text-[11px] tabular opacity-70">{String(i + 1).padStart(2, '0')}</span>
                <span className="min-w-0 flex-1 truncate">{s.title}</span>
                <span className="tabular opacity-70">{s.minutes}m</span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    </div>
  )
}
