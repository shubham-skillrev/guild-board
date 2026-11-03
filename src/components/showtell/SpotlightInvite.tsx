'use client'

import { useState } from 'react'
import { Kers } from '@/components/kers/Kers'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/hooks/useToast'
import { useShowTell } from '@/components/showtell/useShowTell'
import { FormatPills } from '@/components/showtell/FormatPills'
import { LIMITS, SMALL_FORMATS, type DemoFormat, type MyDemo } from '@/lib/showtell'

/**
 * A Spotlight invitation, on the invitee's board. Framed as what it is: the
 * guild asked to see their work. Accepting takes a format (and an optional
 * title); passing is always one tap. Once the year's two passes are used, the
 * card offers the smaller formats instead and the way out becomes "not this
 * year", which also stops invitations until January.
 */
export function SpotlightInvite() {
  const { data, refresh } = useShowTell()
  const invites = data?.mine.filter(d => d.kind === 'spotlight' && d.status === 'invited') ?? []
  if (!invites.length) return null
  return (
    <>
      {invites.map(inv => (
        <Invite key={inv.id} invite={inv} passesLeft={data!.passes_left} onDone={refresh} />
      ))}
    </>
  )
}

function Invite({ invite, passesLeft, onDone }: { invite: MyDemo; passesLeft: number; onDone: () => void }) {
  const toast = useToast()
  const small = passesLeft === 0
  const [format, setFormat] = useState<DemoFormat | null>(small ? 'lightning' : 'demo')
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState<'accept' | 'pass' | null>(null)

  const answer = async (action: 'accept' | 'pass') => {
    setBusy(action)
    try {
      const res = await fetch(`/api/demos/${invite.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, format, title }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not save that')
      toast(action === 'accept' ? 'You’re on. The guild will be glad.' : small ? 'Not this year. No more invitations until January.' : 'Passed. No hard feelings.', 'success')
      onDone()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save that', 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <section aria-label="Spotlight invitation" className="elev-2 rounded-(--radius-card) p-5 sm:p-6">
      <div className="flex items-start gap-4 sm:gap-5">
        <Kers size={72} expression="excited" colour="proud" follow className="shrink-0" />
        <div className="min-w-0 flex-1">
          <p className="eyebrow">Spotlight{invite.cycle_label ? ` · ${invite.cycle_label} meeting` : ''}</p>
          <h2 className="mt-1.5 text-[17px] font-semibold tracking-[-0.01em] text-ink">The guild wants to see your work.</h2>
          {invite.note && (
            <p className="mt-2 text-footnote leading-relaxed text-ink-soft">
              Nominated because: <span className="text-ink">“{invite.note}”</span>
            </p>
          )}
          <p className="mt-2 text-footnote leading-relaxed text-ink-muted">
            Ten minutes, any format, no slides needed. It’s also the easiest practice you’ll get at explaining your
            work to a room.
          </p>
        </div>
      </div>

      <div className="mt-5 space-y-3 sm:pl-[92px]">
        {small && (
          <p className="text-footnote text-ink-soft">You’ve used this year’s two passes, so here are the lighter ways in:</p>
        )}
        <FormatPills name={`spot-${invite.id}`} value={format} onChange={setFormat} only={small ? SMALL_FORMATS : undefined} />
        <Input
          aria-label="Title (optional)"
          placeholder="Working title (optional)"
          maxLength={LIMITS.title}
          value={title}
          onChange={e => setTitle(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Button disabled={!!busy || !format} onClick={() => answer('accept')}>
            {busy === 'accept' ? 'Saving…' : 'I’m in'}
          </Button>
          <Button variant="ghost" disabled={!!busy} onClick={() => answer('pass')}>
            {small ? 'Not this year' : `Pass this time (${passesLeft} left this year)`}
          </Button>
        </div>
      </div>
    </section>
  )
}
