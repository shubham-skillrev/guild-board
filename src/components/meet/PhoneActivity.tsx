'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, Play, X } from '@phosphor-icons/react/dist/ssr'
import { Kers } from '@/components/kers/Kers'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Input, Textarea } from '@/components/ui/Input'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/utils/cn'
import { CLOUD_MAX_WORDS, CLOUD_WORD_MAX, type Mine, type PublicActivity } from '@/lib/meet/activity'
import { bossProblem, callText, showValue, summarise, type CaseResult } from '@/lib/meet/boss'
import { runBoss } from '@/lib/meet/bossRunner'
import { OptionShape, tileFor } from '@/components/meet/tiles'

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
 * this person has answered (`mine`). The Boss Round runs its tests in a Web
 * Worker on this device and sends only { passed, tests, of }, never the code.
 */
export function PhoneActivity(props: Props) {
  switch (props.activity.kind) {
    case 'poll':
      return <PhonePoll {...props} />
    case 'cloud':
      return <PhoneCloud {...props} />
    case 'boss':
      return <PhoneBoss {...props} />
  }
}

function Prompt({ children }: { children: React.ReactNode }) {
  return <h1 className="mt-6 text-[24px] font-semibold leading-tight tracking-[-0.02em] text-ink text-balance @3xl:text-[36px]">{children}</h1>
}

/** Kers' reaction to a vote: one per option, so changing your mind gets a new one. */
const LOCKED = ['Locked in.', 'Bold. Locked in.', 'Noted. Locked in.', 'Brave. Locked in.']

/**
 * One vote, changeable until the poll closes. The options are the shared
 * screen's tiles (the same shape and colour per option), big tap targets;
 * the chosen one fills, the rest step back, and Kers locks it in.
 */
function PhonePoll({ activity, mine, onMine, post, toast }: Props) {
  const saved = typeof mine?.values[0]?.option === 'number' ? (mine.values[0].option as number) : null
  const [picked, setPicked] = useState<number | null>(null)
  const [sending, setSending] = useState(false)
  const chosen = picked ?? saved
  const long = activity.options.some(o => o.length > 22)

  const vote = async (option: number) => {
    if (option === chosen && !sending) return
    setPicked(option)
    setSending(true)
    try {
      const r = await post({ action: 'respond', activity_id: activity.id, value: { option } })
      if (r.mine) onMine(r.mine)
    } catch (err) {
      // Shown as locked in straight away; a refusal rolls it back to what was saved.
      setPicked(null)
      toast(err instanceof Error ? err.message : 'Could not vote. Try again.', 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      <Prompt>{activity.prompt}</Prompt>
      <div role="radiogroup" aria-label={activity.prompt} className={cn('mt-6 grid gap-2.5', long ? 'grid-cols-1' : 'grid-cols-2')}>
        {activity.options.map((o, i) => {
          const on = chosen === i
          const tile = tileFor(i)
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => vote(i)}
              className={cn(
                'press relative flex w-full items-center gap-3 rounded-[16px] border-2 px-4 text-left text-[16px] font-medium leading-snug text-ink transition-[opacity,background-color,border-color] duration-200',
                long ? 'min-h-16 py-3' : 'min-h-28 flex-col items-start justify-between py-3.5',
                on ? cn(tile.on, 'gb-lock') : tile.tile,
                chosen !== null && !on && 'opacity-55',
              )}
            >
              <OptionShape i={i} size={long ? 22 : 26} />
              <span className="min-w-0 flex-1">{o}</span>
              {on && <Icon icon={Check} size="sm" weight="bold" className={cn('absolute right-3 top-3', tile.ink)} />}
            </button>
          )
        })}
      </div>
      <div className="mt-5 flex min-h-12 items-center gap-3" aria-live="polite">
        {chosen !== null ? (
          <>
            <Kers key={chosen} size={44} colour="meeting" expression="excited" motion="hop" special="happy" />
            <p className="text-[15px] font-medium text-ink">{LOCKED[chosen % LOCKED.length]}<span className="block text-footnote font-normal text-ink-muted">Change it any time until the poll closes.</span></p>
          </>
        ) : (
          <p className="text-footnote text-ink-muted">Tap one. Match the shape on the screen.</p>
        )}
      </div>
    </div>
  )
}

/** Up to three words, 20 characters each. A blocked word is dropped and Kers says so. */
function PhoneCloud({ activity, mine, onMine, post, toast }: Props) {
  const saved = (mine?.values ?? []).map(v => String(v.word ?? '')).filter(Boolean)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  // Words shown at once, before the server confirms; dropped again if it refuses.
  const [pendingWords, setPendingWords] = useState<string[]>([])
  const words = [...saved, ...pendingWords.filter(w => !saved.includes(w))].slice(0, CLOUD_MAX_WORDS)
  const [refused, setRefused] = useState<string | null>(null)
  const left = CLOUD_MAX_WORDS - words.length

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    const word = text.trim()
    if (!word || sending) return
    const shown = word.toLowerCase().slice(0, CLOUD_WORD_MAX)
    setSending(true)
    setRefused(null)
    setText('')
    setPendingWords(p => [...p, shown])
    try {
      const r = await post({ action: 'respond', activity_id: activity.id, value: { word } })
      if (r.mine) onMine(r.mine)
      if (r.blocked) { setRefused(r.message ?? 'Kers didn’t like that one'); setText(word) }
    } catch (err) {
      setText(word)
      toast(err instanceof Error ? err.message : 'Could not send that. Try again.', 'error')
    } finally {
      setPendingWords(p => p.filter(w => w !== shown))
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
            <Button type="submit" disabled={sending || !text.trim()}>Send</Button>
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

/**
 * Kers' Boss Round: the problem, one editor (BossEditor, CodeMirror with
 * JavaScript highlighting, the same on a phone and a laptop; a plain
 * textarea while it loads) and "Run tests". Read-only once closed. No clock: it runs until the presenter closes it,
 * and then this person sees "Watch the screen" for Kers' verdict. The
 * tests run in a Web Worker on this device (lib/meet/bossRunner.ts); each
 * run's result replaces the last one on the screen. The code stays here (and
 * in this browser's storage, so a refresh keeps it).
 */
function PhoneBoss({ activity, mine, onMine, post, toast }: Props) {
  const problem = bossProblem(activity.config)
  const storeKey = `gb-boss:${activity.id}`
  const [code, setCode] = useState(problem?.starter ?? '')
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<CaseResult[] | null>(null)
  const [fatal, setFatal] = useState<string | null>(null)
  const escaped = useRef(false)
  const readOnly = activity.status !== 'open'
  // CodeMirror, loaded only now that a Boss Round is on screen; the plain textarea until then, or if it fails.
  const [Editor, setEditor] = useState<typeof import('./BossEditor').BossEditor | null>(null)
  useEffect(() => {
    let on = true
    import('./BossEditor').then(m => { if (on) setEditor(() => m.BossEditor) }).catch(() => {})
    return () => { on = false }
  }, [])

  // Their code survives a refresh.
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        const saved = localStorage.getItem(storeKey)
        if (saved) setCode(saved)
      } catch {}
    }, 0)
    return () => clearTimeout(id)
  }, [storeKey])

  if (!problem) return <p className="m-auto py-10 text-center text-footnote text-ink-muted">Kers forgot to pick a problem. Watch the screen.</p>

  const last = mine?.values[0]
  const sent = last && typeof last.tests === 'number' ? { tests: last.tests as number, of: Number(last.of), passed: last.passed === true } : null

  const edit = (next: string) => {
    setCode(next)
    try {
      localStorage.setItem(storeKey, next)
    } catch {}
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab indents; Esc then Tab leaves the editor, so the keyboard isn't trapped.
    if (e.key === 'Escape') { escaped.current = true; return }
    if (e.key === 'Tab' && !e.shiftKey && !escaped.current && !e.metaKey && !e.ctrlKey && !e.altKey) {
      e.preventDefault()
      const el = e.currentTarget
      el.setRangeText('  ', el.selectionStart, el.selectionEnd, 'end')
      edit(el.value)
    }
    escaped.current = false
  }

  const run = async () => {
    if (running) return
    setRunning(true)
    setFatal(null)
    setResults([])
    try {
      const r = await runBoss(code, problem, (i, res) => setResults(prev => [...(prev ?? []).slice(0, i), res]))
      setResults(r.results)
      setFatal(r.fatal)
      const res = await post({ action: 'respond', activity_id: activity.id, value: summarise(r.results, problem.cases.length) })
      if (res.mine) onMine(res.mine)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not run the tests', 'error')
    } finally {
      setRunning(false)
    }
  }

  const done = results && !running ? results.filter(r => r.ok).length : null
  const status = running
    ? `Running test ${Math.min((results?.length ?? 0) + 1, problem.cases.length)} of ${problem.cases.length}…`
    : fatal ? 'It didn’t run. Fix it and try again.'
    : done !== null && results?.length ? (done === problem.cases.length ? `All ${done} passed. The screen knows.` : `${done} of ${problem.cases.length} passed.`)
    : sent ? `Your last run: ${sent.tests} of ${sent.of} passed.`
    : 'Write it, then run the tests. Only the result leaves this device.'

  return (
    <div>
      <div className="mt-2 flex items-center gap-2.5">
        <Kers size={36} colour="meeting" expression="nosy" motion="idle" />
        <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-ink-muted">Kers’ Boss Round</p>
      </div>
      <Prompt>{problem.title}</Prompt>
      <p className="mt-2 text-footnote leading-relaxed text-ink-soft">{problem.description}</p>
      <p className="mt-3 font-mono text-footnote text-ink">
        <span className="text-ink-muted">function </span>{problem.signature}
      </p>

      {Editor ? (
        <div className="mt-4">
          <Editor value={code} onChange={edit} readOnly={readOnly} label="Your code" describedBy="boss-code-hint" />
        </div>
      ) : (
        <>
          <label htmlFor="boss-code" className="sr-only">Your code</label>
          <Textarea
            id="boss-code"
            value={code}
            onChange={e => edit(e.target.value)}
            onKeyDown={onKeyDown}
            readOnly={readOnly}
            rows={9}
            wrap="off"
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            autoComplete="off"
            data-gramm="false"
            aria-describedby="boss-code-hint"
            className="mt-4 min-h-40 overflow-x-auto font-mono leading-relaxed [tab-size:2] pointer-coarse:text-[16px]"
          />
        </>
      )}
      <p id="boss-code-hint" className="sr-only">Tab indents. Press Escape, then Tab, to leave the editor.</p>

      <div className="mt-3 flex items-center gap-3">
        <Button icon={Play} onClick={run} disabled={running || readOnly || !code.trim()}>{running ? 'Running…' : 'Run tests'}</Button>
        <p className="min-w-0 flex-1 text-footnote text-ink-muted" aria-live="polite">
          {status}
        </p>
      </div>

      {fatal && <p role="alert" className="mt-4 break-words rounded-(--radius-control) bg-vermillion-light px-3 py-2 font-mono text-footnote text-vermillion">{fatal}</p>}

      <ol aria-label="Tests" className="mt-5 divide-y divide-border border-y border-border">
        {problem.cases.map((c, i) => {
          const r = fatal ? undefined : results?.[i]
          return (
            <li key={i} className="flex gap-2.5 py-2.5 font-mono text-[12px] leading-relaxed">
              <span className={cn('mt-0.5 shrink-0', !r ? 'text-ink-muted' : r.ok ? 'text-matcha' : 'text-vermillion')}>
                {r ? <Icon icon={r.ok ? Check : X} size="sm" weight="bold" /> : <span aria-hidden className="inline-block size-4 text-center">·</span>}
                <span className="sr-only">{!r ? 'Not run' : r.ok ? 'Passed' : 'Failed'}</span>
              </span>
              <div className="min-w-0 flex-1 break-words">
                <p className="text-ink">{callText(problem, c)} <span className="text-ink-muted">→ {showValue(c.expected)}</span></p>
                {r && !r.ok && (
                  <p className="text-vermillion">{r.error ?? `got ${r.got}`}</p>
                )}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
