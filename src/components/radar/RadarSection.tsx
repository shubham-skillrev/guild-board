'use client'

import { useState } from 'react'
import { AnimatePresence } from 'framer-motion'
import { ArrowFatUp, ArrowSquareOut, Plus, Trash } from '@phosphor-icons/react/dist/ssr'
import { SectionHeader } from '@/components/ui/Section'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { Input, Label } from '@/components/ui/Input'
import { Icon } from '@/components/ui/Icon'
import { useToast } from '@/hooks/useToast'
import { useGuestGate } from '@/components/auth/GuestGate'
import { useRadar } from '@/components/radar/useRadar'
import { RADAR_LIMITS, RADAR_TOP, type RadarItem } from '@/lib/radar'
import { cn } from '@/lib/utils/cn'

/**
 * The Radar, on the Bytes page: what the guild wants in the meeting's five
 * minutes of "what's new". This month's Bytes people voted for sit beside
 * links members put forward; the top three make the meeting.
 */
export function RadarSection({ className }: { className?: string }) {
  const { data, reload, vote } = useRadar()
  const { blockGuest } = useGuestGate()
  const toast = useToast()
  const [adding, setAdding] = useState(false)

  if (!data?.cycle) return null

  const remove = async (item: RadarItem) => {
    const res = await fetch(`/api/radar/${item.id}`, { method: 'DELETE' }).catch(() => null)
    if (res?.ok) reload()
    else toast('Could not take it down', 'error')
  }

  return (
    <section id="radar" aria-labelledby="bytes-radar" className={cn('scroll-mt-20', className)}>
      <SectionHeader
        id="bytes-radar"
        title="Radar"
        hint={`The top ${RADAR_TOP} open the ${data.cycle.label} meeting. Vote, or put a link forward.`}
        action={
          <Button variant="secondary" icon={Plus} onClick={() => { if (!blockGuest()) setAdding(true) }}>
            Add a link
          </Button>
        }
      />
      {data.items.length === 0 ? (
        <p className="elev-1 rounded-(--radius-card) px-4 py-5 text-footnote text-ink-muted">
          Nothing on the Radar yet. Upvote a byte below, or add something you read this month.
        </p>
      ) : (
        <ol className="elev-1 rounded-(--radius-card) divide-y divide-separator overflow-hidden">
          {data.items.map((item, i) => (
            <RadarRow
              key={`${item.kind}:${item.id}`}
              item={item}
              rank={i + 1}
              onVote={() => { if (!blockGuest()) vote(item) }}
              onRemove={item.mine ? () => remove(item) : undefined}
            />
          ))}
        </ol>
      )}
      <AnimatePresence>{adding && <AddLink onClose={() => setAdding(false)} onDone={reload} />}</AnimatePresence>
    </section>
  )
}

export function RadarRow({
  item,
  rank,
  onVote,
  onRemove,
  compact = false,
}: {
  item: RadarItem
  rank: number
  onVote: () => void
  onRemove?: () => void
  compact?: boolean
}) {
  const top = rank <= RADAR_TOP
  const external = item.kind === 'link'
  return (
    <li className="flex items-center gap-3 px-4 py-3">
      <span className={cn('w-5 shrink-0 text-center font-mono text-[11px] tabular', top ? 'text-ink' : 'text-cha')}>{rank}</span>
      <div className="min-w-0 flex-1">
        <a
          href={item.href}
          {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
          className="group inline-flex max-w-full items-center gap-1 text-footnote text-ink hover:text-saffron transition-colors"
        >
          <span className="truncate">{item.title}</span>
          {external && <Icon icon={ArrowSquareOut} size="sm" className="shrink-0 text-ink-muted" />}
        </a>
        <p className="truncate text-meta text-ink-muted">
          {item.source}
          {item.by ? ` · from @${item.by}` : item.kind === 'byte' ? ' · Bytes' : ''}
          {!compact && item.note ? ` · ${item.note}` : ''}
        </p>
      </div>
      {onRemove && !compact && (
        <button type="button" onClick={onRemove} aria-label="Take it down" className="press p-1.5 text-ink-muted hover:text-vermillion">
          <Icon icon={Trash} size="sm" />
        </button>
      )}
      <button
        type="button"
        onClick={onVote}
        aria-pressed={item.voted}
        aria-label={`${item.voted ? 'Remove your vote for' : 'Vote for'} ${item.title}`}
        className={cn(
          'press-sm flex w-10 shrink-0 flex-col items-center rounded-(--radius-control) py-1 text-caption tabular transition-colors',
          item.voted ? 'bg-ink text-parchment' : 'bg-fill text-ink-soft hover:text-ink',
        )}
      >
        <Icon icon={ArrowFatUp} size="sm" weight={item.voted ? 'fill' : 'regular'} />
        {item.votes}
      </button>
    </li>
  )
}

function AddLink({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const toast = useToast()
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await fetch('/api/radar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, title, note }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not add that')
      toast('On the Radar. Your vote is already on it.', 'success')
      onDone()
      onClose()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not add that', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Put a link on the Radar" subtitle="Something new this month the guild should hear about in a minute. Three a month each." onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <Label htmlFor="radar-url">Link</Label>
          <Input id="radar-url" type="url" required inputMode="url" placeholder="https://" maxLength={RADAR_LIMITS.url} value={url} onChange={e => setUrl(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="radar-title">Title</Label>
          <Input id="radar-title" required maxLength={RADAR_LIMITS.title} value={title} onChange={e => setTitle(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="radar-note">Why it matters, in a line (optional)</Label>
          <Input id="radar-note" maxLength={RADAR_LIMITS.note} value={note} onChange={e => setNote(e.target.value)} placeholder="e.g. cuts our CI time if it works for us" />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button type="submit" disabled={busy}>{busy ? 'Adding…' : 'Add to Radar'}</Button>
        </div>
      </form>
    </Modal>
  )
}
