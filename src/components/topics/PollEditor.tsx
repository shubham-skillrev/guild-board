'use client'

import { X } from '@phosphor-icons/react/dist/ssr'
import { cn } from '@/lib/utils/cn'
import { POLL_MAX_OPTIONS, POLL_MIN_OPTIONS, POLL_OPTION_MAX, POLL_QUESTION_MAX } from '@/lib/polls'
import type { PollInput } from '@/types'

export interface PollDraft {
  question: string
  options: string[]
}

export const emptyPoll = (): PollDraft => ({ question: '', options: ['', ''] })

/** The draft as the API wants it, or null when it is not complete yet. */
export function pollPayload(draft: PollDraft): PollInput | null {
  const question = draft.question.trim()
  const options = draft.options.map(o => o.trim()).filter(Boolean)
  if (question.length < 3 || options.length < POLL_MIN_OPTIONS) return null
  return { question, options }
}

/**
 * Optional poll on a post: one question, two to four answers. Collapsed to a
 * link until asked for, like "Add context", so the composer stays two lines.
 */
export function PollEditor({
  value,
  onChange,
  fieldClassName,
}: {
  value: PollDraft | null
  onChange: (next: PollDraft | null) => void
  fieldClassName: string
}) {
  if (!value) {
    return (
      <button
        type="button"
        onClick={() => onChange(emptyPoll())}
        className="text-[13px] text-cha hover:text-ink transition-colors"
      >
        + Add a poll <span className="text-ink-muted">(optional)</span>
      </button>
    )
  }

  const setOption = (i: number, text: string) =>
    onChange({ ...value, options: value.options.map((o, j) => (j === i ? text : o)) })

  return (
    <fieldset className="space-y-2">
      <div className="flex items-center justify-between">
        <legend className="block text-[13px] font-medium text-ink">Poll</legend>
        <button
          type="button"
          onClick={() => onChange(null)}
          className="text-[12px] text-cha hover:text-vermillion transition-colors"
        >
          Remove poll
        </button>
      </div>

      <input
        type="text"
        aria-label="Poll question"
        value={value.question}
        onChange={e => onChange({ ...value, question: e.target.value })}
        maxLength={POLL_QUESTION_MAX}
        placeholder="Ask one thing, e.g. Which do you use in prod?"
        className={cn(fieldClassName, 'h-10 text-[14px]')}
      />

      {value.options.map((option, i) => (
        <div key={i} className="flex items-center gap-2">
          <input
            type="text"
            aria-label={`Option ${i + 1}`}
            value={option}
            onChange={e => setOption(i, e.target.value)}
            maxLength={POLL_OPTION_MAX}
            placeholder={`Option ${i + 1}`}
            className={cn(fieldClassName, 'h-10 text-[14px]')}
          />
          {value.options.length > POLL_MIN_OPTIONS && (
            <button
              type="button"
              aria-label={`Remove option ${i + 1}`}
              onClick={() => onChange({ ...value, options: value.options.filter((_, j) => j !== i) })}
              className="shrink-0 inline-flex items-center justify-center w-8 h-8 rounded-full text-cha hover:text-ink hover:bg-kinu/60 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      ))}

      {value.options.length < POLL_MAX_OPTIONS && (
        <button
          type="button"
          onClick={() => onChange({ ...value, options: [...value.options, ''] })}
          className="text-[13px] text-cha hover:text-ink transition-colors"
        >
          + Add option
        </button>
      )}
    </fieldset>
  )
}
