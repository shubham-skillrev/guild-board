'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { CaretUp, Check, X } from '@phosphor-icons/react/dist/ssr'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils/cn'
import { openCount, QUESTION_MAX, type PublicQuestion } from '@/lib/meet/questions'
import { REACT_GAP_MS, REACTION_EMOJI, REACTION_LABEL, REACTIONS, reactionBursts, type Reaction, type ReactionTotals } from '@/lib/meet/reactions'

/**
 * Meeting mode's extras (docs/08-meeting-mode-v2.md, Batch 4, migration 051),
 * kept small and quiet:
 *
 *   phones      ReactionBar (🔥 😂 👏) and AskAnything (send a question,
 *               upvote others'), under whatever the phone shows
 *   the screen  ReactionFloats (what's new floats up and fades; under
 *               reduced motion only a quiet count), QuestionQueue (the
 *               presenter's side panel, Q), QuestionOverlay (the one
 *               question pulled onto the slide), HiddenWords (a word cloud's
 *               hidden words, to bring back)
 */

function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setReduce(mq.matches)
    const first = setTimeout(on, 0)
    mq.addEventListener('change', on)
    return () => {
      clearTimeout(first)
      mq.removeEventListener('change', on)
    }
  }, [])
  return reduce
}

// ─── Reactions ─────────────────────────────────────────────────────────────

type Float = { id: number; r: Reaction; x: number; delay: number }

/**
 * The shared screen's reactions: each new one (the room's totals moved)
 * floats up from the bottom corner and fades, ~2.4 s. Decorative (aria-hidden).
 * Under reduced motion nothing moves: a quiet running count instead.
 */
export function ReactionFloats({ totals, className }: { totals: ReactionTotals | null | undefined; className?: string }) {
  const reduce = useReducedMotion()
  const prev = useRef<ReactionTotals | null>(null)
  const seq = useRef(0)
  const [floats, setFloats] = useState<Float[]>([])
  useEffect(() => {
    const was = prev.current
    prev.current = totals ? { ...totals } : null
    if (reduce) return
    const burst = reactionBursts(was, totals)
    if (!burst.length) return
    const add = burst.map((r, i) => ({ id: ++seq.current, r, x: Math.round(Math.random() * 96), delay: i * 140 }))
    const id = setTimeout(() => setFloats(f => [...f, ...add].slice(-24)), 0)
    return () => clearTimeout(id)
  }, [totals, reduce])
  const done = useCallback((id: number) => setFloats(f => f.filter(x => x.id !== id)), [])

  if (reduce) {
    const any = totals && REACTIONS.some(r => totals[r] > 0)
    if (!any) return null
    return (
      <p className={cn('pointer-events-none flex items-center gap-3 text-footnote text-ink-muted', className)} aria-label="Reactions">
        {REACTIONS.map(r => (
          <span key={r} className="tabular">
            <span aria-hidden>{REACTION_EMOJI[r]}</span> {totals![r]}
            <span className="sr-only"> {REACTION_LABEL[r]}</span>
          </span>
        ))}
      </p>
    )
  }
  return (
    <div aria-hidden className={cn('pointer-events-none relative h-0 w-32', className)}>
      {floats.map(f => (
        <FloatingEmoji key={f.id} f={f} onDone={done} />
      ))}
    </div>
  )
}

function FloatingEmoji({ f, onDone }: { f: Float; onDone: (id: number) => void }) {
  const ref = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const drift = (f.x % 2 ? 1 : -1) * (8 + (f.x % 18))
    const anim = el.animate(
      [
        { transform: 'translate(0, 0) scale(0.6)', opacity: 0 },
        { transform: `translate(${drift / 2}px, -50px) scale(1)`, opacity: 1, offset: 0.18 },
        { transform: `translate(${drift}px, -240px) scale(1)`, opacity: 0 },
      ],
      { duration: 2400, delay: f.delay, easing: 'cubic-bezier(0.23, 1, 0.32, 1)', fill: 'both' },
    )
    anim.onfinish = () => onDone(f.id)
    return () => anim.cancel()
  }, [f, onDone])
  return (
    <span ref={ref} className="absolute bottom-0 text-[28px] leading-none opacity-0" style={{ left: f.x }}>
      {REACTION_EMOJI[f.r]}
    </span>
  )
}

/** The phone's three reactions, small. A tap is sent; the server drops one that comes too fast. */
export function ReactionBar({ onReact }: { onReact: (r: Reaction) => void }) {
  const [cool, setCool] = useState(false)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current) }, [])
  const tap = (r: Reaction) => {
    if (cool) return
    onReact(r)
    setCool(true)
    timer.current = setTimeout(() => setCool(false), REACT_GAP_MS)
  }
  return (
    <div role="group" aria-label="React" className="flex items-center gap-2">
      <span className="mr-1 text-footnote text-ink-muted">React</span>
      {REACTIONS.map(r => (
        <button
          key={r}
          type="button"
          aria-label={REACTION_LABEL[r]}
          onClick={() => tap(r)}
          aria-disabled={cool}
          className={cn('press-sm inline-flex size-8 items-center justify-center rounded-full bg-kinu/70 text-[16px] transition-opacity hover:bg-kinu pointer-coarse:size-10', cool && 'opacity-50')}
        >
          <span aria-hidden>{REACTION_EMOJI[r]}</span>
        </button>
      ))}
    </div>
  )
}

// ─── Ask anything (phones) ─────────────────────────────────────────────────

/**
 * Ask anything, on a phone: closed it's one quiet row ("Ask anything · 3
 * questions"); open, a line to type a question (anonymous, 200 characters)
 * and the queue to upvote, most votes first. Answered ones sink, dimmed.
 */
export function AskAnything({
  questions,
  voted,
  onAsk,
  onVote,
}: {
  questions: PublicQuestion[]
  voted: string[]
  /** Send it: resolves to an error or Kers' quiet drop message to show, or null when it went. */
  onAsk: (text: string) => Promise<string | null>
  onVote: (id: string, on: boolean) => void
}) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [note, setNote] = useState<string | null>(null)
  const waiting = openCount(questions)
  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!text.trim() || busy) return
    setBusy(true)
    setNote(null)
    const said = await onAsk(text.trim())
    setBusy(false)
    if (said) setNote(said)
    else {
      setText('')
      setNote('Sent. Nobody sees it was you.')
    }
  }
  return (
    <section aria-label="Ask anything" className="rounded-(--radius-card) border border-border">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} className="flex h-11 w-full items-center gap-2 px-4 text-left">
        <span className="text-[14px] font-medium text-ink">Ask anything</span>
        <span className="text-footnote text-ink-muted">· anonymous{questions.length ? ` · ${waiting} ${waiting === 1 ? 'question' : 'questions'}` : ''}</span>
        <Icon icon={CaretUp} size="sm" className={cn('ml-auto text-ink-muted transition-transform', !open && 'rotate-180')} />
      </button>
      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3">
          <form onSubmit={submit} className="flex gap-2">
            <label htmlFor="meet-ask" className="sr-only">Your question</label>
            <Input id="meet-ask" value={text} onChange={e => setText(e.target.value)} maxLength={QUESTION_MAX} placeholder="Your question" autoComplete="off" className="h-8 min-w-0 flex-1 pointer-coarse:h-11" />
            <Button type="submit" variant="secondary" disabled={busy || !text.trim()}>{busy ? 'Sending…' : 'Send'}</Button>
          </form>
          {note && <p role="status" className="mt-2 text-footnote text-ink-muted">{note}</p>}
          {questions.length > 0 && (
            <ul className="mt-3 space-y-1.5">
              {questions.map(q => {
                const mine = voted.includes(q.id)
                return (
                  <li key={q.id} className={cn('flex items-start gap-3 py-1', q.answered && 'opacity-55')}>
                    <button
                      type="button"
                      onClick={() => onVote(q.id, !mine)}
                      disabled={q.answered && !mine}
                      aria-pressed={mine}
                      aria-label={`${mine ? 'Take back your upvote' : 'Upvote'} (${q.votes})`}
                      className={cn('press-sm inline-flex h-8 min-w-11 shrink-0 items-center justify-center gap-1 rounded-full px-2 text-[12px] tabular', mine ? 'bg-ink text-parchment' : 'bg-kinu/70 text-ink-soft hover:bg-kinu')}
                    >
                      <Icon icon={CaretUp} size="sm" weight="bold" />
                      {q.votes}
                    </button>
                    <p className="min-w-0 flex-1 pt-1.5 text-[14px] leading-snug text-ink text-pretty">
                      {q.text}
                      {q.answered && <span className="ml-1.5 text-footnote text-ink-muted">· answered</span>}
                    </p>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      )}
    </section>
  )
}

// ─── The presenter's side ──────────────────────────────────────────────────

/**
 * The presenter's question queue, a side panel (Q): most votes first, each
 * with "Show" (pull it onto the slide; "Take down" when it's up) and
 * "Answered". Text and counts only: nobody's name, ever.
 */
export function QuestionQueue({
  questions,
  shownId,
  ready,
  busy,
  onShow,
  onAnswer,
  onClose,
  className,
}: {
  questions: PublicQuestion[]
  shownId: string | null
  /** False before migration 051. */
  ready: boolean
  busy?: boolean
  onShow: (id: string | null) => void
  onAnswer: (id: string, answered: boolean) => void
  onClose?: () => void
  className?: string
}) {
  const waiting = openCount(questions)
  return (
    <aside aria-label="Questions from the room" className={cn('flex flex-col rounded-(--radius-card) border border-border bg-parchment', className)}>
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-border pl-4 pr-1.5">
        <p className="text-footnote font-medium text-ink">Questions</p>
        <p className="text-footnote text-ink-muted">{waiting} waiting</p>
        {onClose && <Button variant="ghost" icon={X} onClick={onClose} aria-label="Close questions" className="ml-auto" />}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
        {!ready ? (
          <p className="text-footnote text-ink-muted">Ask-anything needs migration 051.</p>
        ) : !questions.length ? (
          <p className="text-footnote text-ink-muted">No questions yet. Phones ask from /meet.</p>
        ) : (
          <ul className="space-y-3">
            {questions.map(q => (
              <li key={q.id} className={cn('rounded-(--radius-control) px-2 py-1.5', q.id === shownId && 'bg-fill', q.answered && 'opacity-55')}>
                <p className="text-[13px] leading-snug text-ink text-pretty">{q.text}</p>
                <div className="mt-1 flex items-center gap-1">
                  <span className="mr-auto inline-flex items-center gap-1 text-footnote tabular text-ink-muted">
                    <Icon icon={CaretUp} size="sm" weight="bold" />
                    {q.votes}
                  </span>
                  {!q.answered && (
                    <Button variant="ghost" size="sm" disabled={busy} onClick={() => onShow(q.id === shownId ? null : q.id)}>
                      {q.id === shownId ? 'Take down' : 'Show on screen'}
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" icon={q.answered ? undefined : Check} disabled={busy} onClick={() => onAnswer(q.id, !q.answered)}>
                    {q.answered ? 'Not answered' : 'Answered'}
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  )
}

/** The question the presenter pulled onto the slide: a quiet card over its foot. The presenter can take it down. */
export function QuestionOverlay({ question, onDismiss, className }: { question: PublicQuestion; onDismiss?: () => void; className?: string }) {
  return (
    <div role="status" className={cn('animate-fade-up flex max-w-[56rem] items-start gap-4 rounded-(--radius-card) border border-border bg-sumi px-6 py-4 shadow-[0_12px_32px_var(--shadow-tint)]', className)}>
      <div className="min-w-0 flex-1">
        <p className="eyebrow flex items-center gap-2">
          <span>From the room</span>
          <span aria-hidden className="text-ink-muted">·</span>
          <span className="inline-flex items-center gap-1 tabular"><Icon icon={CaretUp} size="sm" weight="bold" />{question.votes}</span>
        </p>
        <p className="mt-1.5 text-[clamp(19px,1.3vw,24px)] font-medium leading-snug text-ink text-pretty">{question.text}</p>
      </div>
      {onDismiss && <Button variant="ghost" icon={X} onClick={onDismiss} aria-label="Take the question down" />}
    </div>
  )
}

/** A word cloud's hidden words, under the cloud on the presenter screen: "Hidden (n)", each to bring back. */
export function HiddenWords({ words, onUnhide, busy }: { words: string[]; onUnhide: (word: string) => void; busy?: boolean }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="mt-3 flex shrink-0 flex-wrap items-center gap-2 text-footnote text-ink-muted">
      <span>Tap a word to hide it.</span>
      {words.length > 0 && (
        <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open} className="press-sm inline-flex h-8 items-center rounded-full px-2 underline-offset-2 hover:text-ink hover:underline">
          Hidden ({words.length})
        </button>
      )}
      {open &&
        words.map(w => (
          <button key={w} type="button" disabled={busy} onClick={() => onUnhide(w)} title="Show it again" className="press-sm inline-flex h-8 items-center gap-1.5 rounded-full bg-fill px-3 text-ink-soft line-through decoration-ink-muted/60 hover:text-ink hover:no-underline">
            {w}
          </button>
        ))}
    </div>
  )
}
