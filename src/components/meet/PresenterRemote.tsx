'use client'

import { ArrowRight, CaretLeft, CaretRight, Play } from '@phosphor-icons/react/dist/ssr'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { Wordmark } from '@/components/ui/Wordmark'
import { cn } from '@/lib/utils/cn'
import { CLOSE_LABEL, KIND_NAME } from '@/components/meet/ActivityPanel'
import { CountdownRing, useCountdown } from '@/components/meet/CountdownRing'
import { QuestionQueue } from '@/components/meet/RoomExtras'
import { remoteNav } from '@/lib/meet/clicker'
import { isQuiz } from '@/lib/meet/bossStages'
import { EXTEND_S } from '@/lib/meet/timer'
import type { PublicActivity } from '@/lib/meet/activity'
import type { PublicQuestion } from '@/lib/meet/questions'
import type { Segment } from '@/lib/meeting'

type Call = (action: string, payload?: Record<string, unknown>, done?: string) => Promise<unknown>

/**
 * The presenter's phone as a clicker (docs/08-meeting-mode-v2.md, Batch 4):
 * /meet/present opened on a phone. Where the slides would be: this slide's
 * title and the next one's, the slide's activity (its ring, +30s, and the
 * one saffron button: open it, close it, reopen it), the presenter's notes,
 * and the question queue; Back and Next, big, at the thumb.
 *
 * It sends the laptop's own actions (goto, open / close / extend activity),
 * so the big screen follows over the meeting channel. Both can be open; the
 * last action wins. While the slide's activity is open, Back and Next are
 * off, as on the laptop (lib/meet/clicker.ts remoteNav).
 */
export function PresenterRemote({
  label,
  agenda,
  idx,
  activity,
  participants,
  busy,
  now,
  refresh,
  go,
  call,
  onClose,
  rehearsal,
  questions,
  shownId,
  extrasReady,
  onShow,
  onAnswer,
  onScreenView,
}: {
  label: string
  agenda: Segment[]
  idx: number
  /** The slide's activity as the room shows it (an activity slide's own, a results slide's `of`). */
  activity: PublicActivity | null
  participants: number
  busy: string | null
  now: () => number
  refresh?: () => void
  go: (to: number) => void
  call: Call
  /** Close it: on to its results slide if that's next, else in place (the laptop's "Close voting"). */
  onClose: () => void
  rehearsal?: boolean
  questions: PublicQuestion[]
  shownId: string | null
  extrasReady: boolean
  onShow: (id: string | null) => void
  onAnswer: (id: string, answered: boolean) => void
  /** Show the full presenter screen here instead. */
  onScreenView: () => void
}) {
  const seg = agenda[idx]
  const next = agenda[idx + 1] ?? null
  const nav = remoteNav(agenda, idx, activity)
  const own = nav.action ? activity : null
  const countdown = useCountdown(own, now, refresh)
  const prep = seg?.prep
  const say = prep?.opener?.trim()
  const points = prep?.points ?? []

  return (
    <div className="fixed inset-0 z-(--z-overlay) flex flex-col bg-parchment text-ink">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
        <Wordmark />
        <span className="inline-flex h-7 items-center rounded-full bg-fill px-2.5 text-footnote text-ink-soft">Remote{rehearsal ? ' · rehearsal' : ''}</span>
        <p className="ml-auto text-footnote text-ink-muted"><span className="tabular text-ink">{participants}</span> in</p>
        <Button variant="ghost" size="sm" onClick={onScreenView}>Screen view</Button>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-muted">{label} · slide <span className="tabular">{idx + 1}</span> of <span className="tabular">{agenda.length}</span></p>
        <h1 className="mt-1.5 text-[22px] font-semibold leading-tight tracking-[-0.02em] text-ink text-balance">{own?.prompt || seg?.title || 'Untitled slide'}</h1>
        <p className="mt-1.5 text-footnote text-ink-muted">{next ? <>Next: <span className="text-ink-soft">{next.title || 'untitled'}</span></> : 'This is the last slide.'}</p>

        {own && (
          <section aria-label={KIND_NAME[own.kind]} className="mt-5 rounded-(--radius-card) border border-border px-4 py-3.5">
            <div className="flex items-center gap-3">
              {countdown && <CountdownRing countdown={countdown} size="phone" />}
              <p className="min-w-0 flex-1 text-footnote text-ink-soft">
                {KIND_NAME[own.kind]} · {own.status === 'ready' ? 'not open yet' : own.status === 'open' ? 'open' : 'closed'}
                {own.status !== 'ready' && <> · <span className="tabular text-ink">{own.answered}</span> answered</>}
              </p>
              {own.status === 'open' && countdown && (
                <Button variant="ghost" disabled={!!busy} onClick={() => call('extend_activity', { activity_id: own.id })} aria-label={`Add ${EXTEND_S} seconds`}>+{EXTEND_S}s</Button>
              )}
            </div>
            <Button
              icon={nav.action === 'open' ? Play : nav.action === 'close' ? ArrowRight : undefined}
              variant={nav.action === 'reopen' ? 'secondary' : 'primary'}
              disabled={!!busy}
              onClick={() => (nav.action === 'close' ? onClose() : call('open_activity', { activity_id: own.id }))}
              className="mt-3 h-12! w-full justify-center text-[15px]!"
            >
              {nav.action === 'open' ? (isQuiz(own.kind) ? 'Open it' : `Open the ${KIND_NAME[own.kind].toLowerCase()}`) : nav.action === 'close' ? CLOSE_LABEL[own.kind] : 'Reopen'}
            </Button>
            {nav.locked && <p className="mt-2 text-footnote text-ink-muted">{CLOSE_LABEL[own.kind]} to move on.</p>}
          </section>
        )}

        {(say || points.length > 0) && (
          <section aria-label="Your notes" className="mt-5 rounded-(--radius-card) border border-dashed border-border-strong px-4 py-3.5">
            {say && (
              <>
                <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-muted">Say first</p>
                <p className="mt-1 text-[15px] leading-relaxed text-ink">{say}</p>
              </>
            )}
            {points.length > 0 && (
              <ul className={cn('space-y-1.5', say && 'mt-3')}>
                {points.map((p, i) => (
                  <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed text-ink-soft">
                    <span aria-hidden className="mt-[0.65em] size-1 shrink-0 rounded-full bg-ink-muted" />
                    {p}
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {(questions.length > 0 || !extrasReady) && (
          <QuestionQueue className="mt-5 max-h-[50vh]" questions={questions} shownId={shownId} ready={extrasReady} busy={!!busy} onShow={onShow} onAnswer={onAnswer} />
        )}
      </main>

      <footer className="grid shrink-0 grid-cols-2 gap-3 border-t border-border px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3">
        <RemoteButton label="Back" icon={CaretLeft} disabled={nav.prev === null || !!busy} onClick={() => nav.prev !== null && go(nav.prev)} />
        <RemoteButton label="Next" icon={CaretRight} disabled={nav.next === null || !!busy} onClick={() => nav.next !== null && go(nav.next)} trailing />
      </footer>
    </div>
  )
}

function RemoteButton({ label, icon, disabled, onClick, trailing }: { label: string; icon: typeof CaretLeft; disabled: boolean; onClick: () => void; trailing?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="press inline-flex h-14 items-center justify-center gap-2 rounded-(--radius-card) bg-kinu/70 text-[15px] font-medium text-ink hover:bg-kinu disabled:opacity-35"
    >
      {!trailing && <Icon icon={icon} size="sm" weight="bold" />}
      {label}
      {trailing && <Icon icon={icon} size="sm" weight="bold" />}
    </button>
  )
}
