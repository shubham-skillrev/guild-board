'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowDown, ArrowUp, Plus, SlackLogo, Sparkle, Trash, Play } from '@phosphor-icons/react/dist/ssr'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Input, Label, Textarea } from '@/components/ui/Input'
import { SectionHeader } from '@/components/ui/Section'
import { cn } from '@/lib/utils/cn'
import { useMeeting } from '@/components/admin/run/useMeeting'
import { LIMITS, MEETING_MINUTES, totalMinutes, type Meeting, type Segment } from '@/lib/meeting'

/**
 * The meeting's agenda: built from what the guild already lined up (Radar,
 * Show & Tell, top topic, clinic, wrap), edited here, and posted to Slack.
 * The bar shows the hour filling up, so a 75-minute agenda is obvious.
 */
export function AgendaBuilder({ initial }: { initial: Meeting }) {
  const { meeting, busy, call } = useMeeting(initial)
  const [agenda, setAgenda] = useState<Segment[]>(initial.agenda)
  const [meetUrl, setMeetUrl] = useState(initial.meetUrl ?? '')
  const dirty = JSON.stringify(agenda) !== JSON.stringify(meeting.agenda) || meetUrl !== (meeting.meetUrl ?? '')
  const total = totalMinutes(agenda)

  const build = async () => {
    const data = await call<{ agenda: Segment[] }>('draft_agenda')
    if (data?.agenda) setAgenda(data.agenda)
  }
  const save = () => call('save', { agenda, meet_url: meetUrl }, 'Agenda saved')
  const update = (id: string, patch: Partial<Segment>) => setAgenda(a => a.map(s => (s.id === id ? { ...s, ...patch } : s)))
  const move = (i: number, by: number) =>
    setAgenda(a => {
      const next = [...a]
      const [s] = next.splice(i, 1)
      next.splice(Math.max(0, Math.min(next.length, i + by)), 0, s)
      return next
    })

  return (
    <section aria-labelledby="run-agenda" className="min-w-0">
      <SectionHeader
        id="run-agenda"
        title="Agenda"
        hint={meeting.agendaPostedAt ? `Posted to Slack ${new Date(meeting.agendaPostedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}` : 'Built from the board, edited by you, posted to Slack'}
        action={
          <Button variant="secondary" icon={Sparkle} disabled={!!busy} onClick={build}>
            {busy === 'draft_agenda' ? 'Building…' : agenda.length ? 'Rebuild from the board' : 'Build from the board'}
          </Button>
        }
      />

      {/* The hour, filling up. */}
      <div className="mb-4">
        <div className="flex h-2.5 overflow-hidden rounded-full bg-kinu" role="img" aria-label={`${total} of ${MEETING_MINUTES} minutes planned`}>
          {agenda.map((s, i) => (
            <span
              key={s.id}
              title={`${s.title}: ${s.minutes} min`}
              className={cn('h-full border-r-2 border-paper last:border-r-0', i % 2 ? 'bg-ink/55' : 'bg-ink/80', total > MEETING_MINUTES && 'bg-vermillion/70')}
              style={{ width: `${(s.minutes / Math.max(MEETING_MINUTES, total)) * 100}%` }}
            />
          ))}
        </div>
        <p className={cn('mt-1.5 text-meta', total > MEETING_MINUTES ? 'text-vermillion' : 'text-ink-muted')}>
          {total} of {MEETING_MINUTES} minutes{total > MEETING_MINUTES ? `: ${total - MEETING_MINUTES} over` : ''}
        </p>
      </div>

      {agenda.length === 0 ? (
        <div className="rounded-(--radius-card) border border-dashed border-border-strong p-6 text-center text-footnote text-ink-muted">
          No agenda yet. “Build from the board” fills it from the Radar, Show & Tell and the top topics.
        </div>
      ) : (
        <ol className="space-y-2.5">
          {agenda.map((s, i) => (
            <li key={s.id} className="rounded-(--radius-card) border border-border bg-paper p-3.5">
              <div className="flex items-start gap-3">
                <span className="mt-2 w-5 shrink-0 font-mono text-[11px] text-cha tabular">{String(i + 1).padStart(2, '0')}</span>
                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex gap-2">
                    <Input aria-label="Segment title" value={s.title} maxLength={LIMITS.title} onChange={e => update(s.id, { title: e.target.value })} className="font-medium" />
                    <label className="flex shrink-0 items-center gap-1.5 text-meta text-ink-muted">
                      <Input
                        type="number"
                        min={1}
                        max={60}
                        value={s.minutes}
                        onChange={e => update(s.id, { minutes: Math.max(1, Math.min(60, Number(e.target.value) || 1)) })}
                        className="w-16 text-right tabular"
                        aria-label="Minutes"
                      />
                      min
                    </label>
                  </div>
                  <Textarea aria-label="Details" rows={2} maxLength={LIMITS.detail} value={s.detail} onChange={e => update(s.id, { detail: e.target.value })} className="font-sans text-footnote" />
                </div>
                <div className="flex shrink-0 flex-col gap-1">
                  <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up" className="press-sm rounded p-1 text-ink-muted hover:text-ink disabled:opacity-30"><Icon icon={ArrowUp} size="sm" /></button>
                  <button type="button" disabled={i === agenda.length - 1} onClick={() => move(i, 1)} aria-label="Move down" className="press-sm rounded p-1 text-ink-muted hover:text-ink disabled:opacity-30"><Icon icon={ArrowDown} size="sm" /></button>
                  <button type="button" onClick={() => setAgenda(a => a.filter(x => x.id !== s.id))} aria-label="Remove" className="press-sm rounded p-1 text-ink-muted hover:text-vermillion"><Icon icon={Trash} size="sm" /></button>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      <button
        type="button"
        onClick={() => setAgenda(a => [...a, { id: `custom-${Date.now()}`, kind: 'custom', title: 'New segment', detail: '', minutes: 5 }])}
        className="press-sm mt-2.5 inline-flex items-center gap-1.5 text-footnote text-ink-muted hover:text-ink"
      >
        <Icon icon={Plus} size="sm" /> Add a segment
      </button>

      <div className="mt-5 space-y-3 rounded-(--radius-card) border border-border bg-paper/60 p-4">
        <div>
          <Label htmlFor="run-meet">Call link</Label>
          <Input id="run-meet" type="url" placeholder="https://meet.google.com/…" value={meetUrl} onChange={e => setMeetUrl(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant={dirty ? 'primary' : 'secondary'} disabled={!!busy || !dirty} onClick={save}>{busy === 'save' ? 'Saving…' : dirty ? 'Save agenda' : 'Saved'}</Button>
          <Button
            variant="secondary"
            icon={SlackLogo}
            disabled={!!busy || dirty || !meeting.agenda.length}
            onClick={() => call('post_agenda', {}, 'Agenda posted to Slack')}
          >
            {busy === 'post_agenda' ? 'Posting…' : meeting.agendaPostedAt ? 'Post again' : 'Post to Slack'}
          </Button>
          <Link
            href="/admin/run/meeting"
            className="press ml-auto inline-flex h-8 items-center gap-1.5 rounded-(--radius-control) bg-ink px-3 text-footnote font-medium text-parchment hover:bg-ink/85 pointer-coarse:h-11"
          >
            <Icon icon={Play} size="sm" weight="fill" /> Meeting mode
          </Link>
        </div>
      </div>
    </section>
  )
}
