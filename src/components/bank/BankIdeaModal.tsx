'use client'

import { useState } from 'react'
import { TITLE_MAX_LENGTH } from '@/lib/constants'
import { KINDS } from '@/lib/kinds'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { Input, Textarea, Label, CharCount } from '@/components/ui/Input'
import type { CategoryTag } from '@/types'

const NOTE_MAX = 500

interface BankIdeaModalProps {
  onClose: () => void
  onSaved: () => void
}

export function BankIdeaModal({ onClose, onSaved }: BankIdeaModalProps) {
  const [title, setTitle] = useState('')
  const [note, setNote] = useState('')
  const [category, setCategory] = useState<CategoryTag | ''>('')
  const [isOpen, setIsOpen] = useState(false)
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/idea-bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          note: note.trim() || undefined,
          category: category || undefined,
          is_open: isOpen,
          is_anonymous: isAnonymous,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to save idea'); return }
      onSaved()
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title="Bank an idea"
      subtitle="Any day, any cycle. Title alone is enough."
      onClose={onClose}
    >
      <form onSubmit={handleSubmit} className="p-5 space-y-5">
        <div>
          <Label htmlFor="bank-title">Idea</Label>
          <Input
            id="bank-title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            maxLength={TITLE_MAX_LENGTH}
            required
            autoFocus
            placeholder="e.g. Why are our builds so slow?"
          />
          <CharCount value={title} max={TITLE_MAX_LENGTH} />
        </div>

        <div>
          <Label htmlFor="bank-note">
            Note <span className="font-normal normal-case tracking-normal text-cha">(optional)</span>
          </Label>
          <Textarea
            id="bank-note"
            value={note}
            onChange={e => setNote(e.target.value)}
            maxLength={NOTE_MAX}
            rows={4}
            placeholder="A line or two so future-you remembers why this mattered."
          />
          <CharCount value={note} max={NOTE_MAX} />
        </div>

        <div>
          <Label>Kind <span className="font-normal normal-case tracking-normal text-cha">(optional)</span></Label>
          {/* Same pills as the composer, but optional: tap the selected one
              again to clear it. */}
          <div className="flex flex-wrap gap-1.5">
            {KINDS.map(k => (
              <button
                key={k.value}
                type="button"
                aria-pressed={category === k.value}
                onClick={() => setCategory(category === k.value ? '' : k.value)}
                className={`press inline-flex items-center h-8 px-3 rounded-full border text-[13px] font-medium transition-colors ${
                  category === k.value
                    ? 'bg-ink border-ink text-parchment'
                    : 'border-border-strong text-ink-soft hover:text-ink hover:border-ink/40'
                }`}
              >
                {k.label}
              </button>
            ))}
          </div>
        </div>

        {/* Up for grabs - the lowest-stakes way to contribute. */}
        <button
          type="button"
          onClick={() => setIsOpen(v => !v)}
          aria-pressed={isOpen}
          className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-(--radius-control) border text-left transition-all ${
            isOpen ? 'border-matcha/40 bg-matcha-light' : 'border-border hover:border-border-strong hover:bg-kinu/30'
          }`}
        >
          <span className={`mt-0.5 shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-all ${
            isOpen ? 'bg-matcha border-matcha' : 'border-border-strong'
          }`}>
            {isOpen && (
              <svg className="w-3 h-3 text-parchment" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            )}
          </span>
          <span className="min-w-0">
            <span className={`block text-[13px] ${isOpen ? 'text-matcha' : 'text-ink-soft'}`}>
              🙌 Offer it to the guild
            </span>
            <span className="block text-[11px] text-cha mt-0.5 leading-relaxed">
              Anyone can pick this up and pitch it. You still get credit.
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => setIsAnonymous(v => !v)}
          aria-pressed={isAnonymous}
          className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-(--radius-control) border text-left transition-all ${
            isAnonymous ? 'border-wisteria/40 bg-wisteria/10' : 'border-border hover:border-border-strong hover:bg-kinu/30'
          }`}
        >
          <span className={`mt-0.5 shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-all ${
            isAnonymous ? 'bg-wisteria border-wisteria' : 'border-border-strong'
          }`}>
            {isAnonymous && (
              <svg className="w-3 h-3 text-parchment" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
              </svg>
            )}
          </span>
          <span className="min-w-0">
            <span className={`block text-[13px] ${isAnonymous ? 'text-wisteria' : 'text-ink-soft'}`}>
              👻 Keep my name off it
            </span>
            <span className="block text-[11px] text-cha mt-0.5 leading-relaxed">
              Your name is hidden if this goes to the board.
            </span>
          </span>
        </button>

        {error && (
          <div className="p-3 bg-vermillion-light border border-vermillion/20 rounded-(--radius-control) text-xs text-vermillion">
            {error}
          </div>
        )}

        <div className="flex gap-3 pt-1">
          <Button type="submit" disabled={loading || title.trim().length < 3}>
            {loading ? 'Saving…' : 'Bank it'}
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Modal>
  )
}
