'use client'

import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { MicrophoneStage, Presentation } from '@phosphor-icons/react/dist/ssr'
import { SectionHeader } from '@/components/ui/Section'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Label, Textarea, CharCount } from '@/components/ui/Input'
import { Icon } from '@/components/ui/Icon'
import { useToast } from '@/hooks/useToast'
import { useGuestGate } from '@/components/auth/GuestGate'
import { useShowTell } from '@/components/showtell/useShowTell'
import { FormatPills } from '@/components/showtell/FormatPills'
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
          variant="secondary"
          className="mt-3 w-full"
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

function VolunteerModal({ meeting, onClose, onDone }: { meeting: string; onClose: () => void; onDone: () => void }) {
  const toast = useToast()
  const [title, setTitle] = useState('')
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
    <Modal title="Show something" subtitle="Ten minutes, no slides needed. A tool you use, a script that saves you time, a bug that ate your week." onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="demo-title">What would you show?</Label>
          <Input id="demo-title" required maxLength={LIMITS.title} value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. My Claude Code setup for reviews" />
        </div>
        <div>
          <Label htmlFor="demo-blurb">One or two lines about it (optional)</Label>
          <Textarea id="demo-blurb" rows={2} maxLength={LIMITS.blurb} value={blurb} onChange={e => setBlurb(e.target.value)} className="font-sans" />
          <CharCount value={blurb} max={LIMITS.blurb} />
        </div>
        <div>
          <Label>Format</Label>
          <FormatPills name="demo-format" value={format} onChange={setFormat} />
        </div>
        <div>
          <Label>When</Label>
          <div role="radiogroup" className="flex flex-wrap gap-1.5 text-footnote">
            {([['this', `The ${meeting} meeting`], ['later', 'A later one']] as const).map(([v, l]) => (
              <label key={v} className="inline-flex items-center gap-2 cursor-pointer text-ink-soft has-checked:text-ink">
                <input type="radio" name="demo-when" checked={when === v} onChange={() => setWhen(v)} className="accent-ink" />
                {l}
              </label>
            ))}
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy || !title.trim()}>{busy ? 'Saving…' : 'Put me in the queue'}</Button>
        </div>
      </form>
    </Modal>
  )
}
