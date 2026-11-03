'use client'

import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { MicrophoneStage, Presentation } from '@phosphor-icons/react/dist/ssr'
import { SectionHeader } from '@/components/ui/Section'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Label, Textarea } from '@/components/ui/Input'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Kers } from '@/components/kers/Kers'
import { Icon } from '@/components/ui/Icon'
import { useToast } from '@/hooks/useToast'
import { useGuestGate } from '@/components/auth/GuestGate'
import { useShowTell } from '@/components/showtell/useShowTell'
import { FormatCards } from '@/components/showtell/FormatCards'
import { LIMITS, formatLabel, type DemoFormat, type Slot } from '@/lib/showtell'
import { cn } from '@/lib/utils/cn'

/**
 * The meeting's two Show & Tell slots, in the board rail: who is on, or an
 * open slot with a way to volunteer. An empty slot is shown as open on
 * purpose: it is the invitation.
 */
export function ShowAndTell() {
  const { data, refresh } = useShowTell()
  const { blockGuest } = useGuestGate()
  const [open, setOpen] = useState(false)

  if (!data?.cycle) return null
  const offer = data.mine.find(d => d.kind === 'demo' && (d.status === 'proposed' || d.status === 'confirmed'))

  return (
    <section aria-labelledby="board-showtell">
      <SectionHeader id="board-showtell" title="Show & Tell" hint={`At the ${data.cycle.label} meeting`} />
      <ul className="elev-1 rounded-(--radius-card) divide-y divide-separator overflow-hidden">
        <SlotRow icon={MicrophoneStage} label="Spotlight" slot={data.spotlight} empty="Nominated by the guild, announced soon" />
        <SlotRow icon={Presentation} label="Demo" slot={data.demo} empty="Open: anyone can take it" />
      </ul>

      {offer ? (
        <p className="mt-2.5 text-footnote text-ink-soft">
          Your offer, <span className="text-ink">“{offer.title}”</span>,{' '}
          {offer.status === 'confirmed' ? `is booked for ${offer.cycle_label ?? 'a meeting'}.` : 'is in the queue.'}
        </p>
      ) : (
        <Button
          variant={data.demo ? 'secondary' : 'tinted'}
          className={cn('mt-3 w-full', !data.demo && 'glow-pulse')}
          onClick={() => { if (!blockGuest()) setOpen(true) }}
        >
          Volunteer to show something
        </Button>
      )}

      <AnimatePresence>
        {open && <VolunteerModal meeting={data.cycle.label} onClose={() => setOpen(false)} onDone={refresh} />}
      </AnimatePresence>
    </section>
  )
}

function SlotRow({ icon, label, slot, empty }: { icon: typeof Presentation; label: string; slot: Slot | null; empty: string }) {
  return (
    <li className="flex items-start gap-3 px-(--pad-card) py-3">
      <span className={cn('mt-0.5 grid size-7 shrink-0 place-items-center rounded-full', slot ? 'bg-ink text-parchment' : 'bg-kinu text-ink-muted')}>
        <Icon icon={icon} size="sm" />
      </span>
      <span className="min-w-0">
        <span className="block text-meta text-ink-muted">{label}</span>
        {slot ? (
          <>
            <span className="block text-footnote text-ink truncate">{slot.title || formatLabel(slot.format)}</span>
            <span className="block text-meta text-ink-muted">@{slot.username} · {formatLabel(slot.format)}</span>
          </>
        ) : (
          <span className="block text-footnote text-ink-soft">{empty}</span>
        )}
      </span>
    </li>
  )
}

export function VolunteerModal({ meeting, onClose, onDone, initialTitle = '' }: { meeting: string; onClose: () => void; onDone: () => void; initialTitle?: string }) {
  const toast = useToast()
  const [title, setTitle] = useState(initialTitle)
  const [blurb, setBlurb] = useState('')
  const [format, setFormat] = useState<DemoFormat>('demo')
  const [when, setWhen] = useState<'this' | 'later'>('this')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await fetch('/api/demos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, blurb, format, when }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not save that')
      toast('You’re in the queue. An organiser will confirm the month.', 'success')
      onDone()
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save that', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Show something at a guild meeting" subtitle="Ten minutes, no slides needed: a tool you use, a script that saves you time, a bug that ate your week." onClose={onClose}>
      <form onSubmit={submit}>
        <div className="space-y-5 p-5">
          <div>
            <Label htmlFor="demo-title">What would you show?</Label>
            <Input
              id="demo-title"
              required
              autoFocus
              maxLength={LIMITS.title}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. My Claude Code setup for reviews"
            />
          </div>
          <div>
            <div className="flex items-baseline justify-between">
              <Label htmlFor="demo-blurb">A line or two about it</Label>
              <span className="text-meta text-ink-muted">optional{blurb.length > LIMITS.blurb * 0.8 ? ` · ${blurb.length}/${LIMITS.blurb}` : ''}</span>
            </div>
            <Textarea
              id="demo-blurb"
              rows={2}
              maxLength={LIMITS.blurb}
              value={blurb}
              onChange={e => setBlurb(e.target.value)}
              placeholder="What will people take away?"
              className="font-sans resize-none"
            />
          </div>
          <fieldset>
            <legend className="mb-1.5 text-footnote text-ink-soft">Format</legend>
            <FormatCards name="demo-format" value={format} onChange={setFormat} />
          </fieldset>
          <div>
            <p className="mb-1.5 text-footnote text-ink-soft">When</p>
            <SegmentedControl
              label="When"
              value={when}
              onChange={setWhen}
              options={[{ key: 'this', label: `${meeting} meeting` }, { key: 'later', label: 'A later one' }]}
            />
          </div>
        </div>
        <div className="flex flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <Kers size={36} expression="excited" className="shrink-0" />
            <p className="min-w-0 text-meta leading-snug text-ink-muted">An organiser confirms the month with you before anything’s announced.</p>
          </div>
          <div className="flex shrink-0 justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={busy || !title.trim()}>{busy ? 'Saving…' : 'Put me in the queue'}</Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
