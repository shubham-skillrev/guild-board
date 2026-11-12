'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, ArrowsIn, ArrowsOut, Play, Stop } from '@phosphor-icons/react/dist/ssr'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/utils/cn'
import { OVERLAY_PRIORITY, useOverlaySlot } from '@/components/ui/OverlaySlot'
import { ActivityPanel } from '@/components/meet/ActivityPanel'
import { AgendaProgress } from '@/components/meet/AgendaProgress'
import { PresenterKers } from '@/components/meet/PresenterKers'
import { useMeetingLive, useSecond } from '@/components/meet/useMeetingLive'
import { clock, KIND_LABELS, type MeetingState, type Segment } from '@/lib/meeting'
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

/**
 * The presenter screen (/meet/present), shared full screen on the call.
 *
 *   header     the month, the meeting clock, who presents ("Take over")
 *   stage      the segment: kind, title, detail, its board posts, then the
 *              activity panel (Phase 2) and Kers' prep: the opener and 2-3
 *              talking points
 *   side       the segment's countdown (overtime past zero) and Kers
 *   footer     agenda progress (weighted bar + dots) and Back / Next
 *
 * Only the presenter moves it (← → or PageUp/PageDown for a clicker, the
 * buttons, the dots); everyone else follows by polling. Esc leaves, F goes
 * full screen. The place lives on the server, so a refresh resumes it.
 */
export function PresenterScreen({ initial, posts }: { initial: MeetingState; posts: Record<string, PresenterPost> }) {
  const router = useRouter()
  const { state, meeting, busy, call, optimistic, now } = useMeetingLive(initial)
  const agenda = meeting.agenda
  const live = !!meeting.startedAt && !meeting.endedAt
  const ended = !!meeting.endedAt
  const local = !meeting.presenterReady
  const t = useSecond(live, now, initial.serverNow)
  // Hold the floating slot so no install or push prompt lands on the share.
  useOverlaySlot('presenter', OVERLAY_PRIORITY.presenter, true)

  const [localPos, setLocalPos] = useState<LocalPos | null>(null)
  useEffect(() => {
    if (!local) return
    const id = setTimeout(() => setLocalPos(readLocal(meeting.cycleId)), 0)
    return () => clearTimeout(id)
  }, [local, meeting.cycleId])

  const segmentId = local ? localPos?.segment : meeting.currentSegment
  const idx = Math.max(0, agenda.findIndex(s => s.id === segmentId))
  const seg: Segment | undefined = agenda[idx]
  const startIso = (local ? localPos?.at : meeting.segmentStartedAt) ?? meeting.startedAt
  const secondsIn = live && startIso ? Math.max(0, (t - new Date(startIso).getTime()) / 1000) : 0
  const remaining = seg ? seg.minutes * 60 - secondsIn : 0
  const over = live && remaining < 0
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
      else if (e.key === 'Escape' && !document.fullscreenElement) router.push('/admin/run/meeting')
      else if (e.key === 'f' || e.key === 'F') fullscreen()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, idx, router, fullscreen])

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

  const meetingClock = live && meeting.startedAt ? clock((t - new Date(meeting.startedAt).getTime()) / 1000) : null
  const segPosts = (seg.topicIds ?? []).map(id => posts[id]).filter(Boolean)
  const prep = seg.prep && (seg.prep.points.length || seg.prep.opener) ? seg.prep : null

  return (
    <Shell>
      {/* ─── Header ─── */}
      <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border px-10">
        <p className="text-[15px] text-ink-muted">
          <span className="font-medium text-ink">{state.cycle.label} guild meeting</span>
          {meetingClock && <span className="font-mono tabular"> · {meetingClock} in</span>}
          {ended && ' · ended'}
        </p>
        <div className="ml-auto flex items-center gap-2">
          {live && !local && (
            presenting ? (
              <span className="text-footnote text-ink-muted">You’re presenting</span>
            ) : (
              <>
                <span className="text-footnote text-ink-muted">
                  {state.presenterName ? `@${state.presenterName} is presenting` : 'Nobody is presenting'} · view only
                </span>
                <Button variant="secondary" disabled={!!busy} onClick={() => call('take_over', {}, 'You’re presenting now')}>
                  {state.presenterName ? 'Take over' : 'Present'}
                </Button>
              </>
            )
          )}
          {live && local && <span className="text-footnote text-ink-muted">Apply migration 045 so other admins can follow along</span>}
          {presenting && !last && (
            <Button variant="ghost" icon={Stop} disabled={!!busy} onClick={end}>End</Button>
          )}
          <Button variant="ghost" icon={isFull ? ArrowsIn : ArrowsOut} onClick={fullscreen} aria-label={isFull ? 'Leave full screen' : 'Full screen'} />
          <Link href="/admin/run/meeting" className="press inline-flex h-8 items-center rounded-full px-3 text-footnote text-ink-muted hover:bg-kinu/60 hover:text-ink">
            Esc
          </Link>
        </div>
      </header>

      {/* ─── Stage and side ─── */}
      <main className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(300px,26vw)] gap-12 px-10 py-10">
        <section aria-live="polite" className="flex min-h-0 min-w-0 flex-col overflow-y-auto">
          <p className="font-mono text-[14px] uppercase tracking-[0.18em] text-ink-muted">
            {String(idx + 1).padStart(2, '0')} / {String(agenda.length).padStart(2, '0')} · {KIND_LABELS[seg.kind]} · {seg.minutes} min
          </p>
          <h1 className="mt-4 text-[clamp(40px,4vw,72px)] font-semibold leading-[1.05] tracking-[-0.035em] text-ink text-balance">{seg.title}</h1>
          {seg.detail && <p className="mt-4 max-w-[60ch] text-[clamp(18px,1.3vw,24px)] leading-relaxed text-ink-soft">{seg.detail}</p>}

          {segPosts.length > 0 && (
            <ul className="mt-8 grid max-w-[72rem] gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(segPosts.length, 2)}, minmax(0, 1fr))` }}>
              {segPosts.map(p => (
                <li key={p.id} className="rounded-[20px] border border-border bg-paper px-6 py-5">
                  <p className="text-[clamp(18px,1.25vw,22px)] font-medium leading-snug text-ink">{p.title}</p>
                  {p.description && <p className="mt-2 line-clamp-4 text-[17px] leading-relaxed text-ink-soft">{p.description}</p>}
                  <p className="mt-3 font-mono text-[13px] tabular text-ink-muted">
                    {p.voteCount} {p.voteCount === 1 ? 'vote' : 'votes'} · {p.commentCount} {p.commentCount === 1 ? 'comment' : 'comments'}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <ActivityPanel segment={seg} state={state} presenting={presenting} />

          {prep && (
            <div className="mt-10 max-w-[72rem] border-t border-border pt-6">
              <p className="font-mono text-[13px] uppercase tracking-[0.18em] text-ink-muted">Kers’ prep</p>
              {prep.opener && <p className="mt-3 text-[clamp(22px,1.7vw,30px)] leading-snug tracking-[-0.01em] text-ink">“{prep.opener}”</p>}
              {prep.points.length > 0 && (
                <ul className="mt-5 space-y-2.5">
                  {prep.points.map((pt, i) => (
                    <li key={i} className="flex gap-3 text-[clamp(17px,1.2vw,21px)] leading-relaxed text-ink-soft">
                      <span aria-hidden className="mt-[0.7em] size-1.5 shrink-0 rounded-full bg-ink-muted" />
                      {pt}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </section>

        <aside className="flex min-h-0 flex-col">
          <div className="rounded-[28px] border border-border bg-paper p-8">
            {live ? (
              <>
                <p className={cn('font-mono text-[clamp(64px,7vw,128px)] leading-none tabular tracking-[-0.04em]', over ? 'text-vermillion' : 'text-ink')}>
                  {over ? '+' : ''}{clock(remaining)}
                </p>
                <p className={cn('mt-3 text-[17px]', over ? 'text-vermillion' : 'text-ink-muted')}>{over ? 'over time' : 'left in this segment'}</p>
              </>
            ) : ended ? (
              <>
                <p className="text-[28px] font-semibold tracking-[-0.02em] text-ink">That’s the meeting.</p>
                <Link href="/admin/run#run-recap" className="mt-4 inline-block text-footnote text-ink underline underline-offset-2">Write the recap</Link>
              </>
            ) : (
              <>
                <p className="font-mono text-[clamp(64px,7vw,128px)] leading-none tabular tracking-[-0.04em] text-ink-muted">{clock(seg.minutes * 60)}</p>
                <p className="mt-3 text-[17px] text-ink-muted">Starts when meeting mode does</p>
                <Button icon={Play} className="mt-6" disabled={!!busy} onClick={start}>
                  {busy === 'start' ? 'Starting…' : 'Start meeting mode'}
                </Button>
              </>
            )}
          </div>
          <PresenterKers className="mt-auto pt-6" segmentKey={seg.id} remaining={remaining} live={live} ended={ended} />
        </aside>
      </main>

      {/* ─── Progress and moving on ─── */}
      <footer className="flex shrink-0 items-end gap-10 border-t border-border px-10 py-6">
        <div className="min-w-0 flex-1">
          <AgendaProgress agenda={agenda} index={idx} secondsIn={secondsIn} onPick={presenting ? go : undefined} />
        </div>
        {presenting && (
          <div className="flex shrink-0 gap-2">
            <Button variant="secondary" icon={ArrowLeft} disabled={idx === 0} onClick={() => go(idx - 1)}>Back</Button>
            {last ? (
              <Button icon={Stop} disabled={!!busy} onClick={end}>End meeting</Button>
            ) : (
              <Button onClick={() => go(idx + 1)}>
                Next <Icon icon={ArrowRight} size="sm" />
              </Button>
            )}
          </div>
        )}
      </footer>
    </Shell>
  )
}

/** Full screen, no site chrome. */
function Shell({ children }: { children: React.ReactNode }) {
  return <div className="fixed inset-0 z-(--z-overlay) flex flex-col bg-parchment text-ink">{children}</div>
}
