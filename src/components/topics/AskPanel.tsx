'use client'

import { useCallback, useEffect, useState } from 'react'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/hooks/useToast'

const NOTE_MAX = 140

interface Ask {
  asked_id: string
  asker_id: string
  note: string | null
  username: string
  can_withdraw: boolean
}

interface Member { id: string; username: string }

/**
 * Invite specific people into a topic.
 *
 * Nothing here records whether an ask was answered, on purpose - a visible
 * "asked and didn't reply" would turn an invitation into an obligation, which
 * is the opposite of what a hesitant member needs.
 */
export function AskPanel({ topicId }: { topicId: string }) {
  const toast = useToast()
  const [asks, setAsks] = useState<Ask[]>([])
  const [candidates, setCandidates] = useState<Member[]>([])
  const [remaining, setRemaining] = useState(2)
  const [picking, setPicking] = useState(false)
  const [selected, setSelected] = useState<Member | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [query, setQuery] = useState('')

  const load = useCallback(async () => {
    try {
      const data = await fetch(`/api/topic-asks?topic_id=${topicId}`).then(r => r.json())
      setAsks(data.asks ?? [])
      setCandidates(data.candidates ?? [])
      setRemaining(data.remaining ?? 0)
    } catch { /* non-critical */ }
  }, [topicId])

  useEffect(() => { load() }, [load])

  const send = async () => {
    if (!selected) return
    setBusy(true)
    try {
      const res = await fetch('/api/topic-asks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_id: topicId, asked_id: selected.id, note: note.trim() || undefined }),
      })
      const data = await res.json()
      if (!res.ok) { toast(data.error || 'Could not send', 'error'); return }
      toast(`Asked @${selected.username} 🙌`, 'success')
      setSelected(null); setNote(''); setPicking(false); setQuery('')
      await load()
    } finally {
      setBusy(false)
    }
  }

  const withdraw = async (ask: Ask) => {
    const res = await fetch('/api/topic-asks', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ topic_id: topicId, asked_id: ask.asked_id }),
    })
    if (!res.ok) { toast('Could not withdraw', 'error'); return }
    await load()
  }

  const filtered = query
    ? candidates.filter(c => c.username?.toLowerCase().includes(query.toLowerCase()))
    : candidates

  return (
    <div className="rounded-xl border border-border bg-paper/50 p-4 mb-6">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-[13px] font-semibold text-ink">Ask someone in</span>
        {remaining > 0 && (
          <span className="text-[11px] text-cha">{remaining} left</span>
        )}
      </div>
      <p className="text-[11px] text-cha leading-relaxed mb-3">
        Know who&apos;s done this before? Ask them directly - it lands far better than hoping they see it.
      </p>

      {asks.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {asks.map(ask => (
            <span
              key={ask.asked_id}
              className="inline-flex items-center gap-1.5 pl-1 pr-2 py-0.5 rounded-full border border-border bg-kinu/40 text-[12px] text-ink-soft"
            >
              <UserAvatar username={ask.username} size={16} />
              @{ask.username}
              {ask.can_withdraw && (
                <button
                  type="button"
                  onClick={() => withdraw(ask)}
                  aria-label={`Withdraw ask to ${ask.username}`}
                  className="text-cha hover:text-vermillion transition-colors ml-0.5"
                >
                  ×
                </button>
              )}
            </span>
          ))}
        </div>
      )}

      {remaining === 0 ? (
        <p className="text-[11px] text-cha">You&apos;ve asked your two for this topic.</p>
      ) : !picking ? (
        <Button size="sm" variant="secondary" onClick={() => setPicking(true)}>
          + Ask someone
        </Button>
      ) : (
        <div className="space-y-2.5">
          {!selected ? (
            <>
              <Input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search members…"
                autoFocus
              />
              <div className="max-h-44 overflow-y-auto rounded-lg border border-border divide-y divide-border">
                {filtered.length === 0 ? (
                  <p className="text-[12px] text-cha px-3 py-2.5">No one left to ask.</p>
                ) : filtered.map(m => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setSelected(m)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-kinu/40 transition-colors"
                  >
                    <UserAvatar username={m.username} size={20} />
                    <span className="text-[13px] text-ink">@{m.username}</span>
                  </button>
                ))}
              </div>
              <Button size="sm" variant="ghost" onClick={() => { setPicking(false); setQuery('') }}>
                Cancel
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <UserAvatar username={selected.username} size={22} />
                <span className="text-[13px] text-ink">@{selected.username}</span>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="text-[11px] text-cha hover:text-ink ml-auto"
                >
                  change
                </button>
              </div>
              <Input
                value={note}
                onChange={e => setNote(e.target.value.slice(0, NOTE_MAX))}
                placeholder="Why them? e.g. you did this at your last job"
              />
              <div className="flex gap-2">
                <Button size="sm" onClick={send} disabled={busy}>
                  {busy ? 'Sending…' : 'Send ask'}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => { setSelected(null); setNote('') }}>
                  Cancel
                </Button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
