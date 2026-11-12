'use client'

import { useState } from 'react'
import { Check } from '@phosphor-icons/react/dist/ssr'
import { Kers } from '@/components/kers/Kers'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Input } from '@/components/ui/Input'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/utils/cn'
import { CLOUD_MAX_WORDS, CLOUD_WORD_MAX, type Mine, type PublicActivity } from '@/lib/meet/activity'

type Post = (body: Record<string, unknown>) => Promise<{ ok?: boolean; blocked?: boolean; message?: string; mine?: Mine }>
type Toast = ReturnType<typeof useToast>

interface Props {
  activity: PublicActivity
  mine: Mine | null
  onMine: (mine: Mine) => void
  post: Post
  toast: Toast
}

/**
 * The open activity on a phone, by kind. Each sends its answer to
 * POST /api/meet { action: 'respond', activity_id, value } and shows what
 * this person has answered (`mine`). Phase 3 adds `boss` here: the problem,
 * the editor and the Web Worker runner, sending { passed, tests, of }.
 */
export function PhoneActivity(props: Props) {
  switch (props.activity.kind) {
    case 'poll':
      return <PhonePoll {...props} />
    case 'cloud':
      return <PhoneCloud {...props} />
    case 'boss':
      return <p className="m-auto py-10 text-center text-footnote text-ink-muted">The Boss Round is nearly here. Watch the screen.</p>
  }
}

function Prompt({ children }: { children: React.ReactNode }) {
  return <h1 className="mt-6 text-[24px] font-semibold leading-tight tracking-[-0.02em] text-ink text-balance">{children}</h1>
}

/** One vote, changeable until the poll closes. Neutral options; the chosen one is filled. */
function PhonePoll({ activity, mine, onMine, post, toast }: Props) {
  const saved = typeof mine?.values[0]?.option === 'number' ? (mine.values[0].option as number) : null
  const [picked, setPicked] = useState<number | null>(null)
  const [sending, setSending] = useState(false)
  const chosen = picked ?? saved

  const vote = async (option: number) => {
    if (option === chosen && !sending) return
    setPicked(option)
    setSending(true)
    try {
      const r = await post({ action: 'respond', activity_id: activity.id, value: { option } })
      if (r.mine) onMine(r.mine)
    } catch (err) {
      setPicked(null)
      toast(err instanceof Error ? err.message : 'Could not vote', 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      <Prompt>{activity.prompt}</Prompt>
      <div role="radiogroup" aria-label={activity.prompt} className="mt-6 space-y-2.5">
        {activity.options.map((o, i) => {
          const on = chosen === i
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => vote(i)}
              className={cn(
                'press flex min-h-12 w-full items-center gap-3 rounded-[14px] border px-4 py-3 text-left text-[16px] transition-colors',
                on ? 'border-ink bg-ink text-parchment' : 'border-border bg-paper text-ink hover:border-border-strong',
              )}
            >
              <span className="min-w-0 flex-1">{o}</span>
              {on && <Icon icon={Check} size="sm" weight="bold" />}
            </button>
          )
        })}
      </div>
      <p className="mt-4 text-footnote text-ink-muted" aria-live="polite">
        {chosen === null ? 'Tap one. You can change it until the poll closes.' : sending ? 'Saving…' : 'Voted. You can change it until the poll closes.'}
      </p>
    </div>
  )
}

/** Up to three words, 20 characters each. A blocked word is dropped and Kers says so. */
function PhoneCloud({ activity, mine, onMine, post, toast }: Props) {
  const words = (mine?.values ?? []).map(v => String(v.word ?? '')).filter(Boolean)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [refused, setRefused] = useState<string | null>(null)
  const left = CLOUD_MAX_WORDS - words.length

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    const word = text.trim()
    if (!word || sending) return
    setSending(true)
    setRefused(null)
    try {
      const r = await post({ action: 'respond', activity_id: activity.id, value: { word } })
      if (r.mine) onMine(r.mine)
      if (r.blocked) setRefused(r.message ?? 'Kers didn’t like that one')
      else setText('')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not send that', 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      <Prompt>{activity.prompt}</Prompt>
      {left > 0 ? (
        <form onSubmit={send} className="mt-6">
          <label htmlFor="meet-word" className="sr-only">Your word</label>
          <div className="flex gap-2">
            <Input
              id="meet-word"
              value={text}
              onChange={e => { setText(e.target.value); setRefused(null) }}
              maxLength={CLOUD_WORD_MAX}
              autoComplete="off"
              autoCapitalize="none"
              enterKeyHint="send"
              placeholder="One word"
              className="h-8 min-w-0 flex-1 pointer-coarse:h-11"
            />
            <Button type="submit" disabled={sending || !text.trim()}>{sending ? 'Sending…' : 'Send'}</Button>
          </div>
          <p className="mt-2 text-footnote text-ink-muted tabular">
            {words.length ? `${left} more ${left === 1 ? 'word' : 'words'} if you like.` : `Up to ${CLOUD_MAX_WORDS} words, ${CLOUD_WORD_MAX} letters each.`}
          </p>
        </form>
      ) : (
        <p className="mt-6 text-footnote text-ink-muted">That’s your three. Watch them land on the screen.</p>
      )}

      {refused && (
        <div role="status" className="mt-4 flex items-center gap-3">
          <Kers size={40} expression="grumpy" state="refusing" colour="meeting" />
          <p className="text-footnote text-ink-soft">{refused}</p>
        </div>
      )}

      {words.length > 0 && (
        <ul aria-label="Your words" className="mt-6 flex flex-wrap gap-2">
          {words.map(w => (
            <li key={w} className="inline-flex h-8 items-center rounded-full bg-kinu/70 px-3 text-footnote text-ink">{w}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
