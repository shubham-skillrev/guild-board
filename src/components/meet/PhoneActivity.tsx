'use client'

import { useEffect, useRef, useState } from 'react'
import { ArrowCounterClockwise, Check, HandsClapping, Play, X } from '@phosphor-icons/react/dist/ssr'
import { Kers } from '@/components/kers/Kers'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Input, Textarea } from '@/components/ui/Input'
import { useToast } from '@/hooks/useToast'
import { cn } from '@/lib/utils/cn'
import { CLOUD_MAX_WORDS, CLOUD_WORD_MAX, type Mine, type PublicActivity } from '@/lib/meet/activity'
import { bossProblem, callText, CHEER_GAP_MS, CHEER_MAX, showValue, summarise, type CaseResult } from '@/lib/meet/boss'
import { fillPublic, predictPublic } from '@/lib/meet/bossStages'
import { BlankCode, CodeBlock } from '@/components/meet/BossStages'
import { runBoss } from '@/lib/meet/bossRunner'
import { OptionShape, tileFor } from '@/components/meet/tiles'
import { CountdownRing, useCountdown, type Countdown } from '@/components/meet/CountdownRing'

type Post = (body: Record<string, unknown>) => Promise<{ ok?: boolean; blocked?: boolean; message?: string; mine?: Mine }>
type Toast = ReturnType<typeof useToast>

interface Props {
  activity: PublicActivity
  mine: Mine | null
  onMine: (mine: Mine) => void
  post: Post
  toast: Toast
  /** The browser's clock corrected by the server's: the countdown agrees with the shared screen. */
  now: () => number
  /** The countdown hit zero: pull the room (the server closes it on that read). */
  onExpire?: () => void
  /** Treat this as a phone whatever its screen (the rehearsal's phone preview): the write stage's watch view. */
  phone?: boolean
}

/** What each kind gets: the countdown (null when untimed). At zero it stops taking answers. */
type KindProps = Omit<Props, 'now' | 'onExpire' | 'phone'> & { countdown: Countdown | null }

/** Said once the countdown is out, before the room catches up. */
const TIMES_UP = 'Time’s up. Watch the screen.'

/**
 * The open activity on a phone, by kind. Each sends its answer to
 * POST /api/meet { action: 'respond', activity_id, value } and shows what
 * this person has answered (`mine`). The Boss Round runs its tests in a Web
 * Worker on this device and sends only { passed, tests, of }, never the code.
 */
export function PhoneActivity({ now, onExpire, phone, ...props }: Props) {
  const countdown = useCountdown(props.activity, now, onExpire)
  switch (props.activity.kind) {
    case 'poll':
      return <PhonePoll {...props} countdown={countdown} />
    case 'predict':
      return <PhonePoll {...props} countdown={countdown} code={predictPublic(props.activity.config).code} />
    case 'fill':
      return <PhoneFill {...props} countdown={countdown} />
    case 'cloud':
      return <PhoneCloud {...props} countdown={countdown} />
    case 'boss':
      return <PhoneBoss {...props} countdown={countdown} phone={phone} />
  }
}

/** A phone, or a narrow window: the write stage is for laptops, so these watch and cheer. */
const PHONE_QUERY = '(pointer: coarse), (max-width: 640px)'

function usePhone(forced?: boolean): boolean {
  const [phone, setPhone] = useState(!!forced)
  useEffect(() => {
    if (forced) return
    const mq = window.matchMedia(PHONE_QUERY)
    const on = () => setPhone(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [forced])
  return !!forced || phone
}

/** The question, with the small countdown ring beside it (the same clock as the shared screen's). */
function Prompt({ children, countdown }: { children: React.ReactNode; countdown: Countdown | null }) {
  return (
    <div className="mt-6 flex items-start gap-3">
      <h1 className="min-w-0 flex-1 text-[24px] font-semibold leading-tight tracking-[-0.02em] text-ink text-balance @3xl:text-[36px]">{children}</h1>
      {countdown && <CountdownRing countdown={countdown} size="phone" />}
    </div>
  )
}

/** Kers' reaction to a vote: one per option. */
const LOCKED = ['Locked in.', 'Bold. Locked in.', 'Noted. Locked in.', 'Brave. Locked in.']

/**
 * One vote, locked on the first tap (the server keeps the first one too:
 * lib/meet/room.ts respond). The options are the shared screen's tiles (the
 * same shape and colour per option), big tap targets; the chosen one fills,
 * the rest step back and stop answering, and Kers locks it in.
 */
function PhonePoll({ activity, mine, onMine, post, toast, countdown, code }: KindProps & { code?: string }) {
  // A Boss Round predict stage: the same one-tap lock, over its code; the answer shows once it closes.
  const quiz = code !== undefined
  const saved = typeof mine?.values[0]?.option === 'number' ? (mine.values[0].option as number) : null
  const [picked, setPicked] = useState<number | null>(null)
  // The server's answer wins: a vote from another tab is the one that counts.
  const chosen = saved ?? picked
  const timeUp = !!countdown?.timeUp && chosen === null
  const locked = chosen !== null || timeUp
  const long = activity.options.some(o => o.length > 22)

  const vote = async (option: number) => {
    if (locked) return
    setPicked(option)
    try {
      const r = await post({ action: 'respond', activity_id: activity.id, value: { option } })
      if (r.mine) onMine(r.mine)
    } catch (err) {
      // Shown as locked in straight away; a refusal unlocks it again (or the clock says time's up).
      setPicked(null)
      toast(err instanceof Error ? err.message : 'Could not vote. Try again.', 'error')
    }
  }

  return (
    <div>
      {quiz && <StageEyebrow>Predict the output</StageEyebrow>}
      <Prompt countdown={countdown}>{activity.prompt}</Prompt>
      {quiz && <CodeBlock code={code} size="phone" className="mt-4" />}
      <div role="radiogroup" aria-label={activity.prompt} aria-readonly={locked || undefined} className={cn(quiz ? 'mt-4' : 'mt-6', 'grid gap-2.5', long ? 'grid-cols-1' : 'grid-cols-2')}>
        {activity.options.map((o, i) => {
          const on = chosen === i
          const tile = tileFor(i)
          return (
            <button
              key={i}
              type="button"
              role="radio"
              aria-checked={on}
              aria-disabled={locked && !on ? true : undefined}
              onClick={() => vote(i)}
              className={cn(
                'relative flex w-full items-center gap-3 rounded-[16px] border-2 px-4 text-left text-[16px] font-medium leading-snug text-ink transition-[opacity,background-color,border-color] duration-200',
                !locked && 'press',
                long ? 'min-h-16 py-3' : 'min-h-28 flex-col items-start justify-between py-3.5',
                on ? cn(tile.on, 'gb-lock') : tile.tile,
                locked && !on && 'opacity-55',
                locked && 'cursor-default',
              )}
            >
              <OptionShape i={i} size={long ? 22 : 26} />
              <span className={cn('min-w-0 flex-1', quiz && 'font-mono')}>{o}</span>
              {on && <Icon icon={Check} size="sm" weight="bold" className={cn('absolute right-3 top-3', tile.ink)} />}
            </button>
          )
        })}
      </div>
      <div className="mt-5 flex min-h-12 items-center gap-3" aria-live="polite">
        {chosen !== null ? (
          <>
            <Kers key={chosen} size={44} colour="meeting" expression="excited" motion="hop" special="happy" />
            <p className="text-[15px] font-medium text-ink">{quiz ? 'Locked in. The answer shows when time’s up.' : LOCKED[chosen % LOCKED.length]}</p>
          </>
        ) : timeUp ? (
          <p className="text-[15px] font-medium text-ink">{TIMES_UP}</p>
        ) : (
          <p className="text-footnote text-ink-muted">One tap locks it in. Match the shape on the screen.</p>
        )}
      </div>
    </div>
  )
}

/** "Kers' Boss Round · <stage>": the small line over a stage. */
function StageEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 flex items-center gap-2.5">
      <Kers size={36} colour="meeting" expression="nosy" motion="idle" />
      <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-ink-muted">Kers’ Boss Round · {children}</p>
    </div>
  )
}

/**
 * Fill the blank: the code with its gaps, and the chips. A tap on a chip
 * fills the next empty gap; a tap on a filled gap clears it. Submit locks the
 * answer (one per person, as a poll; lib/meet/room.ts respond). Whether it was
 * right shows only once the stage closes.
 */
function PhoneFill({ activity, mine, onMine, post, toast, countdown }: KindProps) {
  const f = fillPublic(activity.config)
  const saved = Array.isArray(mine?.values[0]?.tokens) ? (mine.values[0].tokens as unknown[]).map(String) : null
  const [picks, setPicks] = useState<(string | null)[]>(() => Array.from({ length: f.blanks }, () => null))
  const [sending, setSending] = useState(false)
  const shown = saved ?? picks
  const locked = !!saved || sending || !!countdown?.timeUp
  const next = shown.findIndex(t => !t)
  const ready = shown.length > 0 && shown.every(Boolean)

  const tap = (chip: string) => {
    if (locked || next < 0) return
    setPicks(p => p.map((t, i) => (i === next ? chip : t)))
  }
  const clear = (i: number) => {
    if (locked) return
    setPicks(p => p.map((t, j) => (j === i ? null : t)))
  }
  const submit = async () => {
    if (locked || !ready) return
    setSending(true)
    try {
      const r = await post({ action: 'respond', activity_id: activity.id, value: { tokens: picks } })
      if (r.mine) onMine(r.mine)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not send that. Try again.', 'error')
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      <StageEyebrow>Fill the blank</StageEyebrow>
      <Prompt countdown={countdown}>{activity.prompt}</Prompt>
      <BlankCode code={f.code} size="phone" filled={shown} onBlank={locked ? undefined : clear} active={locked ? undefined : next} className="mt-4" />
      <ul aria-label="Chips" className="mt-4 flex flex-wrap gap-2">
        {f.chips.map(c => (
          <li key={c}>
            <button
              type="button"
              disabled={locked || next < 0}
              onClick={() => tap(c)}
              className="press inline-flex h-11 items-center rounded-full border border-border bg-paper px-4 font-mono text-[15px] text-ink transition-opacity duration-200 disabled:cursor-default disabled:opacity-50"
            >
              {c}
            </button>
          </li>
        ))}
      </ul>
      <div className="mt-5 flex min-h-12 items-center gap-3" aria-live="polite">
        {saved ? (
          <>
            <Kers size={44} colour="meeting" expression="excited" motion="hop" special="happy" />
            <p className="text-[15px] font-medium text-ink">Locked in. The answer shows when time’s up.</p>
          </>
        ) : countdown?.timeUp ? (
          <p className="text-[15px] font-medium text-ink">{TIMES_UP}</p>
        ) : (
          <>
            <Button onClick={submit} disabled={!ready || sending}>{sending ? 'Sending…' : 'Submit'}</Button>
            {shown.some(Boolean) && <Button variant="ghost" icon={ArrowCounterClockwise} onClick={() => setPicks(p => p.map(() => null))}>Clear</Button>}
            <p className="min-w-0 flex-1 text-footnote text-ink-muted">{ready ? 'Submit locks it in.' : 'Tap a chip for each gap.'}</p>
          </>
        )}
      </div>
    </div>
  )
}

/** Up to three words, 20 characters each. A blocked word is dropped and Kers says so. */
function PhoneCloud({ activity, mine, onMine, post, toast, countdown }: KindProps) {
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
    if (!word || sending || countdown?.timeUp) return
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
      <Prompt countdown={countdown}>{activity.prompt}</Prompt>
      {countdown?.timeUp ? (
        <p className="mt-6 text-[15px] font-medium text-ink" aria-live="polite">{TIMES_UP}</p>
      ) : left > 0 ? (
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
 * textarea while it loads) and "Run tests". Read-only once closed or once its countdown is out: it runs until then,
 * and then this person sees "Watch the screen" for Kers' verdict. The
 * tests run in a Web Worker on this device (lib/meet/bossRunner.ts); each
 * run's result replaces the last one on the screen. The code stays here (and
 * in this browser's storage, so a refresh keeps it).
 */
function PhoneBoss({ phone, ...props }: KindProps & { phone?: boolean }) {
  const isPhone = usePhone(phone)
  const [anyway, setAnyway] = useState(false)
  if (isPhone && !anyway) return <PhoneWatch {...props} onCode={() => setAnyway(true)} />
  return <BossCoder {...props} />
}

/**
 * The write stage on a phone: no editor (it's for laptops). The room's live
 * count ("4 coding · 2 passed"), the ring, and a cheer button: rate-limited
 * here (one per CHEER_GAP_MS) and on the server, which keeps the count. The
 * screen shows the room's cheers. "Code here anyway" for a tablet.
 */
function PhoneWatch({ activity, mine, onMine, post, toast, countdown, onCode }: KindProps & { onCode: () => void }) {
  const { passed = 0, coding = 0, cheers = 0 } = activity.tally ?? {}
  const own = Math.max(0, Number(mine?.values.find(v => typeof v.n === 'number')?.n ?? 0))
  const [sent, setSent] = useState(0)
  const [cool, setCool] = useState(false)
  const mineCheers = Math.max(own, sent)
  const done = mineCheers >= CHEER_MAX || activity.status !== 'open' || !!countdown?.timeUp
  const cheer = async () => {
    if (cool || done) return
    setCool(true)
    setSent(n => Math.max(n, own) + 1)
    setTimeout(() => setCool(false), CHEER_GAP_MS)
    try {
      const r = await post({ action: 'respond', activity_id: activity.id, value: { cheer: true } })
      if (r.mine) onMine(r.mine)
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not cheer. Try again.', 'error')
    }
  }
  return (
    <div>
      <StageEyebrow>Write it</StageEyebrow>
      <Prompt countdown={countdown}>Laptops are coding</Prompt>
      <p className="mt-2 text-footnote leading-relaxed text-ink-soft">This round is for keyboards. Watch the screen, and cheer them on.</p>
      <p className="mt-6 font-mono text-[15px] tabular text-ink" aria-live="polite">
        <span className="text-[24px] font-semibold tracking-[-0.02em]">{coding}</span> coding
        <span aria-hidden className="mx-2 text-ink-muted">·</span>
        <span className="text-[24px] font-semibold tracking-[-0.02em] text-matcha">{passed}</span> passed
      </p>
      <div className="mt-6 flex items-center gap-3">
        <Button variant="tinted" icon={HandsClapping} onClick={cheer} disabled={cool || done} className="h-11! px-5!">
          Cheer
        </Button>
        <p className="text-footnote text-ink-muted tabular" aria-live="polite">
          {cheers > 0 ? `${cheers} ${cheers === 1 ? 'cheer' : 'cheers'} on the screen` : 'Be the first to cheer.'}
          {mineCheers > 0 && ` · ${mineCheers} yours`}
        </p>
      </div>
      <button type="button" onClick={onCode} className="mt-8 text-footnote text-ink-muted underline underline-offset-2 hover:text-ink">
        On a tablet with a keyboard? Code here anyway
      </button>
    </div>
  )
}

function BossCoder({ activity, mine, onMine, post, toast, countdown }: KindProps) {
  const problem = bossProblem(activity.config)
  const storeKey = `gb-boss:${activity.id}`
  const [code, setCode] = useState(problem?.starter ?? '')
  const [running, setRunning] = useState(false)
  const [results, setResults] = useState<CaseResult[] | null>(null)
  const [fatal, setFatal] = useState<string | null>(null)
  const escaped = useRef(false)
  // The first edit tells the room this person is coding (the screen's "N coding"), once.
  const told = useRef(false)
  const readOnly = activity.status !== 'open' || !!countdown?.timeUp
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

  // Their last run (slot 0); a "started" mark sits beside it.
  const last = mine?.values.find(v => typeof v.tests === 'number')
  const sent = last && typeof last.tests === 'number' ? { tests: last.tests as number, of: Number(last.of), passed: last.passed === true } : null

  const edit = (next: string) => {
    setCode(next)
    try {
      localStorage.setItem(storeKey, next)
    } catch {}
    if (!told.current && activity.status === 'open') {
      told.current = true
      post({ action: 'respond', activity_id: activity.id, value: { started: true } }).catch(() => { told.current = false })
    }
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
  const status = countdown?.timeUp && !running
    ? TIMES_UP
    : running
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
      <Prompt countdown={countdown}>{problem.title}</Prompt>
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
