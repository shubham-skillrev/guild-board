'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowsIn, ArrowsOut, CaretLeft, CaretRight, Play, Stop } from '@phosphor-icons/react/dist/ssr'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/utils/cn'
import { OVERLAY_PRIORITY, useOverlaySlot } from '@/components/ui/OverlaySlot'
import { ActivityHero, ActivityReady, segmentActivity } from '@/components/meet/ActivityPanel'
import { AgendaProgress } from '@/components/meet/AgendaProgress'
import { PresenterKers } from '@/components/meet/PresenterKers'
import { bossPhase } from '@/lib/meet/boss'
import { useMeetingLive, useSecond } from '@/components/meet/useMeetingLive'
import { KIND_LABELS, meetingLive, type MeetingState, type Segment } from '@/lib/meeting'
import type { PresenterPost } from '@/lib/guild/meetingPrep'

/** Where the screen is when migration 045 isn't applied: this browser only. */
const localKey = (cycleId: string) => `gb-meet:${cycleId}`
type LocalPos = { segment: string; at: string }

function readLocal(cycleId: string): LocalPos | null {
  try {
    return JSON.parse(localStorage.getItem(localKey(cycleId)) ?? 'null')
  } catch {
    return null
  }
}

/** Whether Kers' notes for the presenter are on screen (P toggles; kept per browser). */
const NOTES_KEY = 'gb-meet-notes'

/**
 * The presenter screen (/meet/present), shared full screen on the call.
 * Minimal on purpose: only what the room needs to see, and no clock (the
 * meeting goes at the presenter's pace: finish an item, or skip it).
 *
 *   header   the month and how many are in the room, quiet; the presenter's
 *            few controls fade in on hover ("Take over" for another admin)
 *   stage    the hero. With an open or closed activity: its question and the
 *            answers (ActivityHero: poll bars, word cloud, Boss pass rate).
 *            Otherwise: the segment's title and Kers' opener, large, its
 *            board posts small, and an activity waiting to open
 *            (ActivityReady, the one saffron button)
 *   notes    Kers' talking points, small and dim, for the presenter (P hides)
 *   footer   one thin line with a dot per segment, evenly spaced, no text;
 *            subtle Back / Next either side, and Kers, small, at the end
 *
 * Only the presenter moves it (← → or PageUp/PageDown for a clicker, the
 * arrows, the dots); everyone else follows (the meeting channel, polling
 * as the fallback). Esc leaves, F goes full screen, P shows or hides the
 * notes. The place lives on the server, so a refresh resumes it.
 */
export function PresenterScreen({ initial, posts }: { initial: MeetingState; posts: Record<string, PresenterPost> }) {
  const { state, busy, call, optimistic, now } = useMeetingLive(initial)
  return <PresenterView state={state} busy={busy} call={call} optimistic={optimistic} now={now} serverNow={initial.serverNow} posts={posts} />
}

type Call = ReturnType<typeof useMeetingLive>['call']

/**
 * The screen itself, from the meeting's state: PresenterScreen feeds it from
 * the server; the dev mock (/meet/mock) feeds it fake state and a no-op
 * `call`. `onExit` replaces Esc's trip to the Run tab.
 */
export function PresenterView({
  state,
  busy,
  call,
  optimistic,
  now,
  serverNow,
  posts,
  onExit,
}: {
  state: MeetingState
  busy: string | null
  call: Call
  optimistic: (patch: Partial<MeetingState['meeting']>) => void
  now: () => number
  /** The server's time in the page's props, so the first render agrees. */
  serverNow: string
  posts: Record<string, PresenterPost>
  onExit?: () => void
}) {
  const router = useRouter()
  const meeting = state.meeting
  const agenda = meeting.agenda
  const live = meetingLive(meeting)
  const ended = !!meeting.endedAt
  const local = !meeting.presenterReady
  // Only for Kers' Boss Round intro (its first 20 s); nothing on screen counts time.
  const t = useSecond(live, now, serverNow)
  // Hold the floating slot so no install or push prompt lands on the share.
  useOverlaySlot('presenter', OVERLAY_PRIORITY.presenter, true)

  const [localPos, setLocalPos] = useState<LocalPos | null>(null)
  useEffect(() => {
    if (!local) return
    const id = setTimeout(() => setLocalPos(readLocal(meeting.cycleId)), 0)
    return () => clearTimeout(id)
  }, [local, meeting.cycleId])

  const [notes, setNotes] = useState(true)
  useEffect(() => {
    const id = setTimeout(() => {
      try { setNotes(localStorage.getItem(NOTES_KEY) !== '0') } catch {}
    }, 0)
    return () => clearTimeout(id)
  }, [])
  const toggleNotes = useCallback(() => {
    setNotes(on => {
      try { localStorage.setItem(NOTES_KEY, on ? '0' : '1') } catch {}
      return !on
    })
  }, [])

  const segmentId = local ? localPos?.segment : meeting.currentSegment
  const idx = Math.max(0, agenda.findIndex(s => s.id === segmentId))
  const seg: Segment | undefined = agenda[idx]
  const activity = live && seg ? segmentActivity(state, seg) : null
  const boss = activity ? bossPhase(activity, t) : null
  const presenting = live && (local || meeting.presenterId === state.me)
  const last = idx === agenda.length - 1

  const go = useCallback(
    (to: number) => {
      if (!presenting || to < 0 || to >= agenda.length || to === idx) return
      const at = new Date(now()).toISOString()
      const segment = agenda[to].id
      if (local) {
        const pos = { segment, at }
        setLocalPos(pos)
        try { localStorage.setItem(localKey(meeting.cycleId), JSON.stringify(pos)) } catch {}
        return
      }
      optimistic({ currentSegment: segment, segmentStartedAt: at })
      call('goto', { segment })
    },
    [presenting, agenda, idx, now, local, meeting.cycleId, optimistic, call],
  )

  const start = async () => {
    const data = await call('start')
    if (data && local && agenda[0]) {
      const pos = { segment: agenda[0].id, at: new Date(now()).toISOString() }
      setLocalPos(pos)
      try { localStorage.setItem(localKey(meeting.cycleId), JSON.stringify(pos)) } catch {}
    }
  }
  const end = () => call('end', {}, 'Meeting ended: the recap is on the Run tab')

  const fullscreen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
    else document.documentElement.requestFullscreen().catch(() => {})
  }, [])
  const [isFull, setIsFull] = useState(false)
  useEffect(() => {
    const on = () => setIsFull(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', on)
    return () => document.removeEventListener('fullscreenchange', on)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if ((e.target as HTMLElement)?.closest('input, textarea, select, [contenteditable]')) return
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(idx + 1) }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(idx - 1) }
      else if (e.key === 'Escape' && !document.fullscreenElement) {
        if (onExit) onExit()
        else router.push('/admin/run/meeting')
      }
      else if (e.key === 'f' || e.key === 'F') fullscreen()
      else if (e.key === 'p' || e.key === 'P') toggleNotes()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, idx, router, fullscreen, onExit, toggleNotes])

  if (!agenda.length || !seg) {
    return (
      <Shell>
        <div className="m-auto max-w-md text-center">
          <p className="text-[28px] font-semibold tracking-[-0.02em] text-ink">No agenda yet.</p>
          <p className="mt-2 text-[17px] text-ink-muted">Build and save one on the Run tab, then come back.</p>
          <Link href="/admin/run" className="mt-6 inline-block text-footnote text-ink underline underline-offset-2">Back to Run</Link>
        </div>
      </Shell>
    )
  }

  const hero = activity && activity.status !== 'ready' ? activity : null
  const ready = activity && activity.status === 'ready' ? activity : null
  const segPosts = hero ? [] : (seg.topicIds ?? []).map(id => posts[id]).filter(Boolean)
  const opener = seg.prep?.opener?.trim() || null
  const points = notes && presenting ? seg.prep?.points ?? [] : []
  const longTitle = seg.title.length > 48

  return (
    <Shell>
      {/* ─── Header: quiet, the controls fade in on hover ─── */}
      <header className="flex h-16 shrink-0 items-center gap-4 px-12">
        <p className="text-[15px] text-ink-muted">
          <span className="font-medium text-ink">{state.cycle.label} guild meeting</span>
          {live && state.room && <span className="tabular"> · {state.room.participants} in the room</span>}
          {ended && ' · ended'}
        </p>
        <div className={cn('ml-auto flex items-center gap-1.5', presenting && 'opacity-40 transition-opacity duration-200 hover:opacity-100 focus-within:opacity-100')}>
          {live && !local && !presenting && (
            <>
              <span className="mr-1.5 text-footnote text-ink-muted">
                {state.presenterName ? `@${state.presenterName} is presenting` : 'Nobody is presenting'} · view only
              </span>
              <Button variant="secondary" disabled={!!busy} onClick={() => call('take_over', {}, 'You’re presenting now')}>
                {state.presenterName ? 'Take over' : 'Present'}
              </Button>
            </>
          )}
          {live && local && <span className="mr-1.5 text-footnote text-ink-muted">Apply migration 045 so other admins can follow along</span>}
          {presenting && seg.prep?.points.length ? (
            <Button variant="ghost" onClick={toggleNotes} aria-pressed={notes} title="P">{notes ? 'Hide notes' : 'Notes'}</Button>
          ) : null}
          {presenting && !last && <Button variant="ghost" icon={Stop} disabled={!!busy} onClick={end}>End</Button>}
          <Button variant="ghost" icon={isFull ? ArrowsIn : ArrowsOut} onClick={fullscreen} aria-label={isFull ? 'Leave full screen' : 'Full screen'} />
          <Link href="/admin/run/meeting" className="press inline-flex h-8 items-center rounded-full px-3 text-footnote text-ink-muted hover:bg-kinu/60 hover:text-ink">
            Esc
          </Link>
        </div>
      </header>

      {/* ─── Stage ─── */}
      <main aria-live="polite" className="flex min-h-0 flex-1 flex-col px-12 pb-6 pt-6 xl:px-24">
        {ended ? (
          <div className="my-auto">
            <h1 className="text-[clamp(56px,5.6vw,104px)] font-semibold leading-[1.02] tracking-[-0.04em] text-ink">That’s the meeting.</h1>
            <Link href="/admin/run#run-recap" className="mt-8 inline-block text-[17px] text-ink underline underline-offset-4">Write the recap</Link>
          </div>
        ) : hero ? (
          <ActivityHero
            key={hero.id}
            segment={seg}
            activity={hero}
            participants={state.room?.participants ?? 0}
            presenting={presenting}
            now={now}
            call={call}
            busy={busy}
          />
        ) : (
          <div key={seg.id} className="animate-fade-up flex min-h-0 flex-1 flex-col">
            <div className="my-auto">
              <p className="font-mono text-[14px] uppercase tracking-[0.18em] text-ink-muted">{KIND_LABELS[seg.kind]}</p>
              <h1
                className={cn(
                  'mt-5 max-w-[24ch] font-semibold tracking-[-0.04em] text-ink text-balance',
                  longTitle ? 'text-[clamp(40px,3.4vw,64px)] leading-[1.06]' : 'text-[clamp(56px,5.6vw,108px)] leading-[1.0]',
                )}
              >
                {seg.title}
              </h1>
              {opener ? (
                <p className="mt-8 max-w-[44ch] text-[clamp(26px,2.1vw,40px)] leading-[1.25] tracking-[-0.02em] text-ink-soft text-balance">“{opener}”</p>
              ) : seg.detail ? (
                <p className="mt-8 max-w-[52ch] text-[clamp(20px,1.5vw,28px)] leading-relaxed text-ink-soft">{seg.detail}</p>
              ) : null}

              {!live && !ended && (
                <div className="mt-12 flex items-center gap-6">
                  <Button icon={Play} disabled={!!busy} onClick={start}>{busy === 'start' ? 'Starting…' : 'Start meeting mode'}</Button>
                  <p className="text-[17px] text-ink-muted">The room opens on everyone’s phone when you do.</p>
                </div>
              )}
              {ready && (
                <div className="mt-12">
                  <ActivityReady activity={ready} presenting={presenting} call={call} busy={busy} />
                </div>
              )}
            </div>

            {segPosts.length > 0 && (
              <ul className="grid max-w-[88rem] shrink-0 gap-4 pt-10" style={{ gridTemplateColumns: `repeat(${Math.min(segPosts.length, 3)}, minmax(0, 30rem))` }}>
                {segPosts.map(p => (
                  <li key={p.id} className="rounded-[18px] border border-border bg-paper px-5 py-4">
                    <p className="line-clamp-2 text-[17px] font-medium leading-snug text-ink">{p.title}</p>
                    <p className="mt-2 font-mono text-[13px] tabular text-ink-muted">
                      From the board · {p.voteCount} {p.voteCount === 1 ? 'vote' : 'votes'} · {p.commentCount} {p.commentCount === 1 ? 'comment' : 'comments'}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {points.length > 0 && !ended && (
          <aside aria-label="Kers’ notes for the presenter" className="mt-6 max-w-[64rem] shrink-0 border-t border-border pt-4">
            <ul className="space-y-1">
              {points.map((pt, i) => (
                <li key={i} className="flex gap-3 text-[15px] leading-relaxed text-ink-muted">
                  <span aria-hidden className="mt-[0.7em] size-1 shrink-0 rounded-full bg-ink-muted/70" />
                  {pt}
                </li>
              ))}
            </ul>
          </aside>
        )}
      </main>

      {/* ─── The line, the arrows, Kers ─── */}
      <footer className="flex h-20 shrink-0 items-center gap-5 pl-12 pr-8 xl:pl-24">
        {presenting && (
          <NavArrow label="Back" icon={CaretLeft} disabled={idx === 0} onClick={() => go(idx - 1)} />
        )}
        <AgendaProgress agenda={agenda} index={idx} onPick={presenting ? go : undefined} className="min-w-0 flex-1" />
        {presenting && (last ? (
          <Button variant="secondary" icon={Stop} disabled={!!busy} onClick={end}>End meeting</Button>
        ) : (
          <NavArrow label="Next" icon={CaretRight} onClick={() => go(idx + 1)} />
        ))}
        <PresenterKers className="-mb-2 ml-3 shrink-0" segmentKey={seg.id} live={live} ended={ended} boss={boss} />
      </footer>
    </Shell>
  )
}

function NavArrow({ label, icon, disabled, onClick }: { label: string; icon: typeof CaretLeft; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={`${label} (${label === 'Back' ? '←' : '→'})`}
      disabled={disabled}
      onClick={onClick}
      className="press-sm inline-flex size-8 shrink-0 items-center justify-center rounded-full text-ink-muted opacity-50 transition-[opacity,background-color,color] duration-200 hover:bg-kinu/70 hover:text-ink hover:opacity-100 focus-visible:opacity-100 disabled:pointer-events-none disabled:opacity-15"
    >
      <Icon icon={icon} size="sm" weight="bold" />
    </button>
  )
}

/** Full screen, no site chrome. */
function Shell({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 z-(--z-overlay) flex flex-col bg-parchment text-ink">{children}</div>
}
