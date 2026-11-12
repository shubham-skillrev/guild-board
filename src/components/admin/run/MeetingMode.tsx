'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, Play, Presentation, Stop, Trash } from '@phosphor-icons/react/dist/ssr'
import { Kers } from '@/components/kers/Kers'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils/cn'
import { useMeetingLive } from '@/components/meet/useMeetingLive'
import { earlyStartWarning, LIMITS, meetingLive, type MeetingState } from '@/lib/meeting'

/**
 * The meeting, live, for the admin running it: one segment at a time (no
 * clock: the presenter finishes an item or skips it), the agenda down the side, and a capture box for notes,
 * decisions and owners that feed the recap. The segment is the shared one
 * (the presenter screen's, migration 045), so this follows /meet/present;
 * the presenter can move it from here too, with the buttons or arrow keys
 * (outside the inputs). Before 045 it keeps its own place, as it used to.
 */
export function MeetingMode({ initial }: { initial: MeetingState }) {
  const { state, meeting, busy, call, optimistic, now } = useMeetingLive(initial)
  const label = state.cycle.label
  const [localIdx, setLocalIdx] = useState(0)
  const [text, setText] = useState('')
  const [owner, setOwner] = useState('')
  const [decision, setDecision] = useState(false)

  const live = meetingLive(meeting)
  const local = !meeting.presenterReady
  const presenting = live && (local || meeting.presenterId === state.me)
  const agenda = meeting.agenda
  const idx = local ? localIdx : Math.max(0, agenda.findIndex(s => s.id === meeting.currentSegment))
  const seg = agenda[idx]

  const go = (to: number) => {
    if (!presenting || to < 0 || to >= agenda.length || to === idx) return
    const at = new Date(now()).toISOString()
    if (local) {
      setLocalIdx(to)
      return
    }
    optimistic({ currentSegment: agenda[to].id, segmentStartedAt: at })
    call('goto', { segment: agenda[to].id })
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
        <p className="text-footnote text-ink-muted">
          {label} meeting{live ? ' · live' : meeting.endedAt ? ' · ended' : ''}
          {live && !local && !presenting && ` · @${state.presenterName ?? 'someone'} is presenting`}
        </p>
        <div className="ml-auto flex gap-2">
          <Link href="/meet/present" className="press inline-flex h-8 items-center gap-1.5 rounded-full bg-kinu/70 px-3 text-footnote font-medium text-ink-soft hover:bg-kinu hover:text-ink">
            <Icon icon={Presentation} size="sm" /> Presenter screen
          </Link>
          {!live && !meeting.endedAt && (
            <Link href="/meet/present?rehearse=1" className="press inline-flex h-8 items-center rounded-full bg-kinu/70 px-3 text-footnote font-medium text-ink-soft hover:bg-kinu hover:text-ink">
              Rehearse
            </Link>
          )}
          {!live && !meeting.endedAt && <Button icon={Play} disabled={!!busy} onClick={async () => { const warning = earlyStartWarning(state.cycle.meeting_at, now()); if (warning && !window.confirm(warning)) return; if (await call('start', {}, 'Meeting started')) { setLocalIdx(0) } }}>Start the meeting</Button>}
          {live && <Button variant="secondary" icon={Stop} disabled={!!busy} onClick={() => call('end', {}, 'Meeting ended: the recap is on the Run tab')}>End the meeting</Button>}
          {meeting.endedAt && <Link href="/admin/run#run-recap" className="press inline-flex h-8 items-center rounded-(--radius-control) bg-ink px-3 text-footnote font-medium text-parchment">Write the recap →</Link>}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px] items-start">
        <div className="space-y-6 min-w-0">
          {/* The segment on now. */}
          <section aria-live="polite" className="relative overflow-hidden rounded-[24px] bg-ink p-6 text-parchment sm:p-8">
            <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-parchment/60">
              {String(idx + 1).padStart(2, '0')} of {String(agenda.length).padStart(2, '0')}
            </p>
            <h2 className="mt-3 text-[28px] sm:text-[36px] font-semibold leading-tight tracking-[-0.03em]">{seg.title}</h2>
            {seg.detail && <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-parchment/80">{seg.detail}</p>}
            {!live && <p className="mt-6 text-meta text-parchment/60">Starts when you start the meeting</p>}
            <Kers size={64} expression="excited" className="absolute bottom-4 right-4 max-sm:hidden" />
          </section>

          {presenting && <div className="flex gap-2">
            <Button variant="secondary" icon={ArrowLeft} disabled={idx === 0} onClick={() => go(idx - 1)}>Back</Button>
            <Button variant="secondary" disabled={idx === agenda.length - 1} onClick={() => go(idx + 1)}>
              Next: {agenda[idx + 1]?.title ?? 'that’s it'} <Icon icon={ArrowRight} size="sm" />
            </Button>
          </div>}

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
                disabled={!presenting}
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
