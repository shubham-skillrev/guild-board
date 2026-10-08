'use client'

import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { TITLE_MAX_LENGTH, DESCRIPTION_MAX_LENGTH } from '@/lib/constants'
import { KINDS, composeDescription, type Kind } from '@/lib/kinds'
import { defaultKind } from '@/lib/themes'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { KindChips } from '@/components/topics/KindChips'
import { cn } from '@/lib/utils/cn'
import type { Cycle } from '@/types'

/* The second answer and the optional context share the description column,
   with room left for their two bold headings. */
const SECTION_MAX_LENGTH = Math.floor((DESCRIPTION_MAX_LENGTH - 60) / 2)

interface SubmitModalProps {
  cycle: Cycle
  onClose: () => void
  onSubmitted: () => void
}

/**
 * The composer. It opens by asking what you are bringing, and the two
 * questions after that are the right two for the kind: a problem asks what you
 * tried, a take asks why you think so. Switching kind keeps whatever you have
 * typed and only changes the questions around it.
 *
 * Two lines is the whole ask. Context is behind a link, anonymity is one
 * switch, and Cmd/Ctrl+Enter posts.
 */
export function SubmitModal({ cycle, onClose, onSubmitted }: SubmitModalProps) {
  const reduce = useReducedMotion()
  const [kindValue, setKindValue] = useState<Kind>(defaultKind(cycle.theme))
  const kind = KINDS.find(k => k.value === kindValue) ?? KINDS[0]

  const [first, setFirst] = useState('')
  const [second, setSecond] = useState('')
  const [context, setContext] = useState('')
  const [showContext, setShowContext] = useState(false)
  const [isAnonymous, setIsAnonymous] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const ready = !!first.trim() && !!second.trim() && !loading

  const submit = async () => {
    if (!ready) return
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: first.trim(),
          description: composeDescription(kind, second, context),
          category: kind.value,
          is_anonymous: isAnonymous,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not post. Try again.')
        return
      }
      onSubmitted()
    } catch {
      setError('Could not post. Check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      submit()
    }
  }

  const field = 'w-full px-3.5 bg-sumi border border-transparent rounded-(--radius-control) text-ink placeholder:text-cha focus:outline-none focus:border-border-strong focus:bg-paper transition-colors'
  const label = 'block text-[13px] font-medium text-ink mb-2'

  /* The question labels swap when the kind changes. A short crossfade makes
     the change legible without moving anything. */
  const swap = reduce
    ? {}
    : { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.15 } }

  return (
    <Modal title={kind.heading} subtitle={`${cycle.label} · Two lines is enough.`} onClose={onClose}>
      <form
        onSubmit={e => { e.preventDefault(); submit() }}
        onKeyDown={onKeyDown}
        className="p-5 space-y-6"
      >
        <KindChips value={kindValue} onChange={setKindValue} featured={cycle.theme?.featured_kind} />

        <div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.label key={`${kind.value}-1`} htmlFor="composer-first" className={label} {...swap}>
              {kind.first.label}
            </motion.label>
          </AnimatePresence>
          <input
            id="composer-first"
            type="text"
            value={first}
            onChange={e => setFirst(e.target.value)}
            maxLength={TITLE_MAX_LENGTH}
            required
            autoFocus
            placeholder={kind.first.example}
            className={cn(field, 'h-11 text-[15px] font-medium')}
          />
          <p className="mt-1.5 text-right font-mono text-[11px] text-cha tabular-nums">
            {first.length}/{TITLE_MAX_LENGTH}
          </p>
        </div>

        <div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.label key={`${kind.value}-2`} htmlFor="composer-second" className={label} {...swap}>
              {kind.second.label}
            </motion.label>
          </AnimatePresence>
          <textarea
            id="composer-second"
            value={second}
            onChange={e => setSecond(e.target.value)}
            maxLength={SECTION_MAX_LENGTH}
            required
            rows={3}
            placeholder={kind.second.example}
            className={cn(field, 'py-2.5 text-[14px] leading-relaxed resize-y')}
          />

          {showContext ? (
            <textarea
              aria-label="More context (optional)"
              value={context}
              onChange={e => setContext(e.target.value)}
              maxLength={SECTION_MAX_LENGTH}
              rows={3}
              autoFocus
              placeholder="Stack, scale, links, what makes it hard. Markdown works."
              className={cn(field, 'mt-3 py-2.5 text-[14px] leading-relaxed resize-y')}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowContext(true)}
              className="mt-2.5 text-[13px] text-cha hover:text-ink transition-colors"
            >
              + Add context <span className="text-ink-muted">(optional)</span>
            </button>
          )}
        </div>

        {/* Anonymity: one switch. Off by default, and the hint says why. */}
        <label className="flex items-start gap-3 cursor-pointer select-none">
          <button
            type="button"
            role="switch"
            aria-checked={isAnonymous}
            onClick={() => setIsAnonymous(v => !v)}
            className={cn(
              'relative mt-0.5 shrink-0 w-8 h-4.5 rounded-full transition-colors',
              isAnonymous ? 'bg-ink' : 'bg-border-strong',
            )}
          >
            <span
              className={cn(
                'absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-paper transition-transform',
                isAnonymous && 'translate-x-3.5',
              )}
            />
            <span className="sr-only">Post anonymously</span>
          </button>
          <span className="min-w-0">
            <span className="block text-[13px] text-ink">Post anonymously</span>
            <span className="block text-[12px] text-cha mt-0.5 leading-relaxed">
              {isAnonymous
                ? 'Your name is hidden from everyone, admins included. Writing style can still give you away in a guild this size.'
                : 'Your name helps people follow up with you.'}
            </span>
          </span>
        </label>

        {error && (
          <p role="alert" className="px-3 py-2.5 rounded-(--radius-control) bg-vermillion-light text-[13px] text-vermillion">
            {error}
          </p>
        )}

        <div className="flex items-center justify-between gap-4 pt-4 border-t border-border">
          <p className="text-[12px] text-cha leading-snug">Client work? Skip the client details.</p>
          <div className="flex items-center gap-2 shrink-0">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={!ready} title="Post (⌘/Ctrl + Enter)">
              {loading ? 'Posting…' : 'Post'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}
