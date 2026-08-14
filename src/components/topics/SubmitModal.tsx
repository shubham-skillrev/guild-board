'use client'

import { useState } from 'react'
import { CATEGORY_LABELS, TITLE_MAX_LENGTH, DESCRIPTION_MAX_LENGTH } from '@/lib/constants'
import { Button } from '@/components/ui/Button'
import type { CategoryTag, Cycle } from '@/types'

const CATEGORIES = Object.entries(CATEGORY_LABELS) as [CategoryTag, string][]

const CATEGORY_ICONS: Record<string, string> = {
  deep_dive: '🔬',
  discussion: '💬',
  blog_idea: '✍️',
  project_showcase: '🚀',
}

interface SubmitModalProps {
  cycle: Cycle
  onClose: () => void
  onSubmitted: () => void
}

export function SubmitModal({ cycle, onClose, onSubmitted }: SubmitModalProps) {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<CategoryTag>('discussion')
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category,
          is_anonymous: isAnonymous,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Failed to submit topic')
        return
      }
      onSubmitted()
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-paper border border-border-strong rounded-(--radius-card) shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto animate-fade-up"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-ink">Pitch an Idea</h2>
            <p className="text-[11px] text-cha mt-0.5">{cycle.label} · What should the guild explore?</p>
          </div>
          <button onClick={onClose} className="text-cha hover:text-ink transition-colors p-1 rounded-md hover:bg-kinu">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-5">
          {/* Category */}
          <div>
            <label className="block text-[11px] font-semibold text-ink-soft uppercase tracking-wider mb-2">Category</label>
            <div className="grid grid-cols-2 gap-2">
              {CATEGORIES.map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setCategory(value)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-(--radius-control) border text-[13px] transition-all text-left ${
                    category === value
                      ? 'border-saffron/40 bg-saffron-light text-saffron'
                      : 'border-border text-ink-soft hover:border-border-strong hover:bg-kinu/30'
                  }`}
                >
                  <span>{CATEGORY_ICONS[value]}</span>
                  <span>{label}</span>
                  {value === 'deep_dive' && (
                    <span className="ml-auto text-[10px] opacity-50">+10%</span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label htmlFor="modal-title" className="block text-[11px] font-semibold text-ink-soft uppercase tracking-wider mb-1.5">
              Title
            </label>
            <input
              id="modal-title"
              type="text"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={TITLE_MAX_LENGTH}
              required
              placeholder="e.g. Let's deep-dive into WebAssembly"
              className="w-full px-3 py-2 bg-sumi border border-border rounded-(--radius-control) text-sm text-ink focus:outline-none focus:border-saffron/50 placeholder:text-cha transition-all"
            />
            <p className="text-[11px] text-cha mt-1 text-right tabular-nums">{title.length}/{TITLE_MAX_LENGTH}</p>
          </div>

          {/* Description */}
          <div>
            <label htmlFor="modal-desc" className="block text-[11px] font-semibold text-ink-soft uppercase tracking-wider mb-1.5">
              Why it matters <span className="font-normal normal-case tracking-normal text-cha">(Markdown supported)</span>
            </label>
            <textarea
              id="modal-desc"
              value={description}
              onChange={e => setDescription(e.target.value)}
              maxLength={DESCRIPTION_MAX_LENGTH}
              required
              rows={6}
              placeholder={"Why is this worth the guild's time?\n\nYou can use **bold**, *italic*, `code`, lists, and links."}
              className="w-full px-3 py-2 bg-sumi border border-border rounded-(--radius-control) text-sm text-ink font-mono focus:outline-none focus:border-saffron/50 resize-y placeholder:text-cha transition-all"
            />
            <p className="text-[11px] text-cha mt-1 text-right tabular-nums">{description.length}/{DESCRIPTION_MAX_LENGTH}</p>
          </div>

          {/* Ghost toggle - lowers the stakes of a first pitch. */}
          <div>
            <button
              type="button"
              onClick={() => setIsAnonymous(v => !v)}
              aria-pressed={isAnonymous}
              className={`w-full flex items-start gap-3 px-3 py-2.5 rounded-(--radius-control) border text-left transition-all ${
                isAnonymous
                  ? 'border-wisteria/40 bg-wisteria/10'
                  : 'border-border hover:border-border-strong hover:bg-kinu/30'
              }`}
            >
              <span
                className={`mt-0.5 shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-all ${
                  isAnonymous ? 'bg-wisteria border-wisteria' : 'border-border-strong'
                }`}
              >
                {isAnonymous && (
                  <svg className="w-3 h-3 text-parchment" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                )}
              </span>
              <span className="min-w-0">
                <span className={`block text-[13px] ${isAnonymous ? 'text-wisteria' : 'text-ink-soft'}`}>
                  👻 Post as ghost
                </span>
                <span className="block text-[11px] text-cha mt-0.5 leading-relaxed">
                  {isAnonymous
                    ? 'Your name is hidden from everyone, admins included. Heads up: in a guild this size, writing style can still give you away - and ghost pitches can’t receive sparks.'
                    : 'Hide your name on this pitch.'}
                </span>
              </span>
            </button>
          </div>

          {error && (
            <div className="p-3 bg-vermillion/10 rounded-(--radius-control) text-[12px] text-vermillion">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <Button type="submit" disabled={loading || !title.trim() || !description.trim()}>
              {loading ? 'Submitting…' : 'Pitch it'}
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
