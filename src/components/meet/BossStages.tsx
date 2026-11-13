'use client'

import { cn } from '@/lib/utils/cn'
import type { PublicActivity } from '@/lib/meet/activity'
import { fillPublic, predictPublic, quizVerdict, splitBlanks } from '@/lib/meet/bossStages'
import { PollResultTiles } from '@/components/meet/Results'
import { OptionShape, tileFor } from '@/components/meet/tiles'

/**
 * The Boss Round's quiz stages (lib/meet/bossStages.ts), drawn the same on
 * the shared screen and every phone, smaller there:
 *
 *   CodeBlock      the stage's code, monospace, on the code surface
 *   BlankCode      fill-the-blank code with its gaps: empty, a phone's own
 *                  picks, or (closed) the right tokens
 *   StageQuestion  the screen while it runs: the code and the tiles (predict)
 *                  or the gaps and the chips (fill). No counts, no answer
 *   StageReveal    after it: % right, Kers' line, the right tile ringed
 *                  (predict) or the gaps filled in (fill). Anonymous
 */

type Size = 'screen' | 'phone'

export function CodeBlock({ code, size, className }: { code: string; size: Size; className?: string }) {
  return (
    <pre
      className={cn(
        'overflow-x-auto whitespace-pre rounded-(--radius-card) border border-border bg-sumi font-mono leading-[1.55] text-ink [tab-size:2]',
        size === 'screen' ? 'px-7 py-6 text-[clamp(20px,1.35vw,27px)]' : 'px-3.5 py-3 text-[13px]',
        className,
      )}
    >
      <code>{code}</code>
    </pre>
  )
}

/**
 * Code with its gaps. `filled` is what goes in each (a phone's picks, or the
 * right answers once closed); `onBlank` makes a gap tappable (a phone
 * clearing its pick). `right` marks the gaps as the reveal: the answer's tint.
 */
export function BlankCode({
  code,
  size,
  filled = [],
  right = false,
  onBlank,
  active,
  className,
}: {
  code: string
  size: Size
  filled?: (string | null | undefined)[]
  right?: boolean
  onBlank?: (i: number) => void
  /** The gap the next chip goes into (phones). */
  active?: number
  className?: string
}) {
  const parts = splitBlanks(code)
  return (
    <pre
      className={cn(
        'overflow-x-auto whitespace-pre rounded-(--radius-card) border border-border bg-sumi font-mono leading-[1.9] text-ink [tab-size:2]',
        size === 'screen' ? 'px-7 py-6 text-[clamp(20px,1.35vw,27px)]' : 'px-3.5 py-3 text-[13px]',
        className,
      )}
    >
      <code>
        {parts.map((p, i) => {
          const last = i === parts.length - 1
          const t = filled[i]
          const gap = (
            <span
              className={cn(
                'mx-0.5 inline-block min-w-[5ch] rounded-[6px] border-b-2 px-1.5 text-center align-baseline leading-[1.35] transition-colors duration-200',
                t ? (right ? 'border-matcha bg-matcha/[0.14] text-ink' : 'border-ink/40 bg-fill text-ink') : 'border-dashed border-ink/35 text-ink-muted',
                active === i && !t && 'border-ink/70 bg-fill',
              )}
            >
              {t || '?'}
            </span>
          )
          return (
            <span key={i}>
              {p}
              {!last &&
                (onBlank && t ? (
                  <button type="button" onClick={() => onBlank(i)} aria-label={`Blank ${i + 1}: ${t}. Tap to clear.`} className="press-sm">
                    {gap}
                  </button>
                ) : (
                  <span aria-label={`Blank ${i + 1}${t ? `: ${t}` : ''}`}>{gap}</span>
                ))}
            </span>
          )
        })}
      </code>
    </pre>
  )
}

/** A quiz stage running, on the shared screen: the code, and the tiles or the chips. Nothing that gives the answer away. */
export function StageQuestion({ activity: a }: { activity: PublicActivity }) {
  if (a.kind === 'predict') {
    const { code } = predictPublic(a.config)
    return (
      <div className="grid max-w-[96rem] grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] items-start gap-10">
        <CodeBlock code={code} size="screen" />
        <ul className="grid grid-cols-1 gap-3">
          {a.options.map((o, i) => (
            <li key={i} className={cn('flex min-h-[76px] items-center gap-5 rounded-(--radius-card) border px-6', tileFor(i).tile)}>
              <OptionShape i={i} size={30} />
              <span className="font-mono text-[clamp(20px,1.3vw,26px)] text-ink">{o}</span>
            </li>
          ))}
        </ul>
      </div>
    )
  }
  const f = fillPublic(a.config)
  return (
    <div className="max-w-[80rem]">
      <BlankCode code={f.code} size="screen" />
      {f.chips.length > 0 && (
        <ul aria-label="Chips on every phone" className="mt-6 flex flex-wrap gap-3">
          {f.chips.map(c => (
            <li key={c} className="inline-flex h-11 items-center rounded-full border border-border bg-paper px-5 font-mono text-[clamp(17px,1.1vw,21px)] text-ink-soft">
              {c}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** The score: % right, how many of how many, and Kers' line. */
export function QuizScore({ activity: a, size }: { activity: PublicActivity; size: Size }) {
  const { correct = 0, answered = a.answered, pct = 0 } = a.tally ?? {}
  const screen = size === 'screen'
  return (
    <div className={cn('flex items-center', screen ? 'gap-8' : 'gap-4')}>
      <p className={cn('num shrink-0 tracking-[-0.04em] text-ink', screen ? 'text-[clamp(64px,5vw,96px)] leading-[0.95]' : 'text-[26px] font-semibold')}>
        {answered ? `${pct}%` : '–'}
        <span className={cn('block font-mono font-normal uppercase tracking-[0.14em] text-ink-muted', screen ? 'mt-2 text-[13px]' : 'text-[10.5px]')}>
          got it right · <span className="tabular">{correct} of {answered}</span>
        </span>
      </p>
      <p className={cn('rounded-2xl rounded-bl-md border border-border bg-sumi leading-snug text-ink text-pretty', screen ? 'px-5 py-3.5 text-[clamp(19px,1.3vw,24px)] font-medium' : 'px-3.5 py-2 text-[13px]')}>
        <span className="sr-only">Kers: </span>
        {quizVerdict(pct, answered)}
      </p>
    </div>
  )
}

/**
 * A quiz stage once it has closed: the score, then the right answer. On a
 * phone, `mine` is what this person picked (predict: the tile; fill: their
 * tokens), marked "you picked" / right or not.
 */
export function StageReveal({ activity: a, size, mine = null }: { activity: PublicActivity; size: Size; mine?: Record<string, unknown> | null }) {
  const screen = size === 'screen'
  if (a.kind === 'predict') {
    const { code, answer } = predictPublic(a.config)
    const picked = typeof mine?.option === 'number' ? mine.option : null
    return (
      <div className={cn('flex min-h-0 flex-col', screen ? 'gap-8' : 'gap-4')}>
        <QuizScore activity={a} size={size} />
        <div className={cn(screen ? 'grid max-w-[96rem] grid-cols-[minmax(0,1fr)_minmax(0,1fr)] items-start gap-10' : 'space-y-3')}>
          <CodeBlock code={code} size={size} />
          <PollResultTiles activity={a} size={size} correct={answer} mine={picked} />
        </div>
      </div>
    )
  }
  const f = fillPublic(a.config)
  const tokens = Array.isArray(mine?.tokens) ? (mine.tokens as unknown[]).map(String) : null
  const right = !!tokens && !!f.answers && f.answers.length === tokens.length && f.answers.every((x, i) => x === tokens[i])
  return (
    <div className={cn('flex min-h-0 flex-col', screen ? 'gap-8' : 'gap-4')}>
      <QuizScore activity={a} size={size} />
      <BlankCode code={f.code} size={size} filled={f.answers ?? []} right className={screen ? 'max-w-[80rem]' : undefined} />
      {tokens && (
        <p className="text-footnote text-ink-soft">
          You filled <span className="font-mono text-ink">{tokens.join(', ')}</span>: {right ? 'right.' : 'not quite.'}
        </p>
      )}
    </div>
  )
}
