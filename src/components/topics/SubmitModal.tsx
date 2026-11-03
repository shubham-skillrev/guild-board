'use client'

import { useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { TITLE_MAX_LENGTH, DESCRIPTION_MAX_LENGTH } from '@/lib/constants'
import { KINDS, composeDescription, type Kind } from '@/lib/kinds'
import { defaultKind } from '@/lib/themes'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { PollEditor, emptyPoll, pollPayload, type PollDraft } from '@/components/topics/PollEditor'
import { Bug, ChartBar, Lightbulb, Megaphone, Plus, Presentation, Rocket } from '@phosphor-icons/react/dist/ssr'
import { cn } from '@/lib/utils/cn'
import type { Cycle } from '@/types'
import { announceSelf } from '@/lib/guildbot-host/live-bus'

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
 * Two lines is the whole ask. Context and a poll are small buttons until
 * asked for, anonymity is one switch beside Post, and Cmd/Ctrl+Enter posts.
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
  const [poll, setPoll] = useState<PollDraft | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // An opened poll must be complete: a question and two answers.
  const pollReady = poll === null || pollPayload(poll) !== null
  const ready = !!first.trim() && !!second.trim() && pollReady && !loading

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
          poll: poll ? pollPayload(poll) : null,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Could not post. Try again.')
        return
      }
      announceSelf({ kind: 'posted', anonymous: isAnonymous })
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
  const label = 'block text-[13px] font-medium text-ink'
  const extra = 'press-sm inline-flex h-8 items-center gap-1.5 rounded-full border border-dashed border-border-strong px-3 text-[13px] text-ink-soft hover:border-ink/40 hover:text-ink transition-colors pointer-coarse:h-10'

  /* The question labels swap when the kind changes. A short crossfade makes
     the change legible without moving anything. */
  const swap = reduce
    ? {}
    : { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.15 } }

  const nearLimit = (value: string, max: number) => value.length > max * 0.8

  return (
    <Modal title={kind.heading} subtitle={`${cycle.label} · Two lines is enough.`} onClose={onClose}>
      <form onSubmit={e => { e.preventDefault(); submit() }} onKeyDown={onKeyDown}>
        <div className="space-y-5 p-5">
          <KindPicker value={kindValue} onChange={setKindValue} featured={cycle.theme?.featured_kind} />

          <div>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <AnimatePresence mode="wait" initial={false}>
                <motion.label key={`${kind.value}-1`} htmlFor="composer-first" className={label} {...swap}>
                  {kind.first.label}
                </motion.label>
              </AnimatePresence>
              {nearLimit(first, TITLE_MAX_LENGTH) && <span className="font-mono text-[11px] text-cha tabular-nums">{first.length}/{TITLE_MAX_LENGTH}</span>}
            </div>
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
          </div>

          <div>
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <AnimatePresence mode="wait" initial={false}>
                <motion.label key={`${kind.value}-2`} htmlFor="composer-second" className={label} {...swap}>
                  {kind.second.label}
                </motion.label>
              </AnimatePresence>
              {nearLimit(second, SECTION_MAX_LENGTH) && <span className="font-mono text-[11px] text-cha tabular-nums">{second.length}/{SECTION_MAX_LENGTH}</span>}
            </div>
            <textarea
              id="composer-second"
              value={second}
              onChange={e => setSecond(e.target.value)}
              maxLength={SECTION_MAX_LENGTH}
              required
              rows={3}
              placeholder={kind.second.example}
              className={cn(field, 'py-2.5 text-[14px] leading-relaxed resize-none')}
            />
            <p className="mt-1.5 text-[12px] text-cha">Client work? Skip the client details.</p>
          </div>

          {showContext && (
            <div>
              <div className="mb-2 flex items-baseline justify-between gap-3">
                <label htmlFor="composer-context" className={label}>More context</label>
                <button type="button" onClick={() => { setShowContext(false); setContext('') }} className="text-[12px] text-cha hover:text-vermillion transition-colors">Remove</button>
              </div>
              <textarea
                id="composer-context"
                value={context}
                onChange={e => setContext(e.target.value)}
                maxLength={SECTION_MAX_LENGTH}
                rows={3}
                autoFocus
                placeholder="Stack, scale, links, what makes it hard. Markdown works."
                className={cn(field, 'py-2.5 text-[14px] leading-relaxed resize-none')}
              />
            </div>
          )}

          {poll && <PollEditor value={poll} onChange={setPoll} fieldClassName={field} />}

          {/* The optional extras, side by side until asked for. */}
          {(!showContext || !poll) && (
            <div className="flex flex-wrap gap-2">
              {!showContext && (
                <button type="button" onClick={() => setShowContext(true)} className={extra}>
                  <Plus className="size-3.5" aria-hidden /> Add context
                </button>
              )}
              {!poll && (
                <button type="button" onClick={() => setPoll(emptyPoll())} className={extra}>
                  <ChartBar className="size-3.5" aria-hidden /> Add a poll
                </button>
              )}
            </div>
          )}

          {error && (
            <p role="alert" className="px-3 py-2.5 rounded-(--radius-control) bg-vermillion-light text-[13px] text-vermillion">
              {error}
            </p>
          )}
        </div>

        {/* Footer: who it's from on the left, posting on the right. */}
        <div className="flex flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:items-center">
          <label className="flex min-w-0 flex-1 cursor-pointer select-none items-start gap-3">
            <button
              type="button"
              role="switch"
              aria-checked={isAnonymous}
              onClick={() => setIsAnonymous(v => !v)}
              className={cn('relative mt-0.5 h-4.5 w-8 shrink-0 rounded-full transition-colors', isAnonymous ? 'bg-ink' : 'bg-border-strong')}
            >
              <span className={cn('absolute left-0.5 top-0.5 h-3.5 w-3.5 rounded-full bg-paper transition-transform', isAnonymous && 'translate-x-3.5')} />
              <span className="sr-only">Post anonymously</span>
            </button>
            <span className="min-w-0">
              <span className="block text-[13px] text-ink">Post anonymously</span>
              <span className="mt-0.5 block text-[12px] leading-snug text-cha">
                {isAnonymous
                  ? 'Hidden from everyone, admins included. Writing style can still give you away.'
                  : 'Your name helps people follow up with you.'}
              </span>
            </span>
          </label>
          <div className="flex shrink-0 justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose}>Cancel</Button>
            <Button type="submit" variant={ready ? 'primary' : 'secondary'} disabled={!ready} title="Post (⌘/Ctrl + Enter)">
              {loading ? 'Posting…' : 'Post'}
            </Button>
          </div>
        </div>
      </form>
    </Modal>
  )
}

const KIND_ICON: Record<Kind, typeof Bug> = {
  problem: Bug,
  learned: Lightbulb,
  new_tech: Rocket,
  take: Megaphone,
  show_tell: Presentation,
}

/**
 * What you're bringing, as five tiles in one row (three across on a phone).
 * Native radios underneath, so arrow keys move the choice. The month's
 * featured kind keeps its "this month" tag.
 */
function KindPicker({ value, onChange, featured }: { value: Kind; onChange: (k: Kind) => void; featured?: Kind | null }) {
  return (
    <fieldset>
      <legend className="sr-only">What are you bringing?</legend>
      <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-5">
        {KINDS.map(k => {
          const Icon = KIND_ICON[k.value]
          return (
            <label
              key={k.value}
              className={cn(
                'group relative flex cursor-pointer select-none flex-col items-center gap-1 rounded-(--radius-control) border px-2 py-2.5 text-center transition-colors',
                'has-checked:border-ink has-checked:bg-ink has-checked:text-parchment',
                'not-has-checked:border-border-strong not-has-checked:text-ink-soft not-has-checked:hover:border-ink/40 not-has-checked:hover:text-ink',
                'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink',
              )}
            >
              <input type="radio" name="composer-kind" className="sr-only" checked={value === k.value} onChange={() => onChange(k.value)} />
              <Icon className="size-4" weight={value === k.value ? 'fill' : 'regular'} aria-hidden />
              <span className="text-[12px] font-medium leading-tight">{k.label}</span>
              {k.value === featured && (
                <span className="-mt-0.5 font-mono text-[9px] tracking-wide text-saffron group-has-checked:text-parchment/70">this month</span>
              )}
            </label>
          )
        })}
      </div>
    </fieldset>
  )
}
