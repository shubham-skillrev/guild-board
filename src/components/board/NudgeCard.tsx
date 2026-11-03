'use client'

import { useEffect, useState } from 'react'
import { Kers } from '@/components/kers/Kers'
import { Button } from '@/components/ui/Button'

interface Note {
  id: string
  body: string
  sentAt: string
  from: string
}

/**
 * A note from a guild organiser, on the member's board until they close it.
 * Kers delivers it; the words are the organiser's. "I'd rather not get these"
 * turns on "No nudges" for good (it's also on the profile).
 */
export function NudgeCard({ onDone }: { onDone?: () => void } = {}) {
  const [notes, setNotes] = useState<Note[]>([])

  useEffect(() => {
    let alive = true
    fetch('/api/nudges', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive && d?.notes) setNotes(d.notes) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  const close = (id: string, stop = false) => {
    const left = stop ? [] : notes.filter(x => x.id !== id)
    setNotes(left)
    if (!left.length) onDone?.()
    fetch(`/api/nudges/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stop }),
    }).catch(() => {})
  }

  if (!notes.length) return null
  const note = notes[0]

  return (
    <section aria-label={`A note from ${note.from}`} className="elev-1 rounded-(--radius-card) p-4 sm:p-5 flex items-start gap-4">
      <Kers size={56} expression="nosy" className="shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-meta text-ink-muted">Kers brought you a note from {note.from}</p>
        <p className="mt-1.5 text-footnote leading-relaxed text-ink">{note.body}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button size="sm" variant="secondary" onClick={() => close(note.id)}>Thanks</Button>
          <button type="button" onClick={() => close(note.id, true)} className="text-meta text-ink-muted hover:text-ink">
            I’d rather not get these
          </button>
        </div>
      </div>
    </section>
  )
}
