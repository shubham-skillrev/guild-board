'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowFatUp, ArrowsIn, ArrowsOut, CaretLeft, CaretRight, ChatCircle, Play, Stop } from '@phosphor-icons/react/dist/ssr'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { Wordmark } from '@/components/ui/Wordmark'
import { cn } from '@/lib/utils/cn'
import { OVERLAY_PRIORITY, useOverlaySlot } from '@/components/ui/OverlaySlot'
import { ActivityHero, ActivityReady, segmentActivity } from '@/components/meet/ActivityPanel'
import { AgendaProgress } from '@/components/meet/AgendaProgress'
import { PresenterKers } from '@/components/meet/PresenterKers'
import { bossPhase } from '@/lib/meet/boss'
import { REHEARSE_ROOM, rehearseActivity, withAnswer } from '@/lib/meet/rehearse'
import { PhonePreview } from '@/components/meet/PhonePreview'
import type { PublicActivity } from '@/lib/meet/activity'
import { useMeetingLive, useSecond } from '@/components/meet/useMeetingLive'
import { earlyStartWarning, KIND_LABELS, meetingLive, type MeetingState, type Segment } from '@/lib/meeting'
import type { PresenterPost } from '@/lib/guild/meetingPrep'

/** Where the screen is when migration 045 isn't applied (or in rehearsal): this browser only. */
const localKey = (cycleId: string, rehearsing: boolean) => `${rehearsing ? 'gb-meet-rehearse' : 'gb-meet'}:${cycleId}`
type LocalPos = { segment: string; at: string }

function readLocal(key: string): LocalPos | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null')
  } catch {
    return null
  }
}

/** Whether Kers' notes for the presenter are on screen (P toggles; kept per browser). */
const NOTES_KEY = 'gb-meet-notes'

/** An activity's state in rehearsal: local only, never sent. */
type RehearsedState = Record<string, { status: PublicActivity['status']; openedAt: string | null }>

/**
 * The presenter screen (/meet/present), shared full screen on the call:
 * GuildBoard on a big screen. The board's language (the serif title, the
 * mono eyebrows, cards and poll rows, Kers' chat bubble), with only what the
 * room needs to see, and no clock: the meeting goes at the presenter's pace.
 *
 *   header   the wordmark, the month, who's in the room (anonymous avatar
 *            seeds, never names); the presenter's few controls fade in on
 *            hover ("Take over" for another admin)
 *   stage    the hero. With an open or closed activity: its question and the
 *            answers (ActivityHero). Otherwise: the segment's title and Kers'
 *            opener, its board posts as small cards, and an activity waiting
 *            to open (ActivityReady, the one saffron button)
 *   notes    Kers' talking points, small and dim, for the presenter (P hides)
 *   footer   one thin line with a dot per segment, evenly spaced, no text;
 *            subtle Back / Next either side, and Kers, small, at the end
 *
 * Only the presenter moves it (← → or PageUp/PageDown for a clicker, the
 * arrows, the dots); everyone else follows (the meeting channel, polling
 * as the fallback). Esc leaves, F goes full screen, P shows or hides the
 * notes. The place lives on the server, so a refresh resumes it.
 *
 * Rehearsal (`rehearsal` set, /meet/present?rehearse=1): the same screen on
 * the real agenda and prep, the day before. Nothing is live and nothing is
 * written: the place is kept in this browser, "Open" fills the activity
 * with sample answers (lib/meet/rehearse.ts), and no action reaches the API.
 */
export function PresenterScreen({ initial, posts, rehearsal }: { initial: MeetingState; posts: Record<string, PresenterPost>; rehearsal?: Record<string, PublicActivity> }) {
  const { state, busy, call, optimistic, now } = useMeetingLive(initial)
  return <PresenterView state={state} busy={busy} call={call} optimistic={optimistic} now={now} serverNow={initial.serverNow} posts={posts} rehearsal={rehearsal} />
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
  rehearsal,
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
  /** Rehearsal: each segment's activity as seeded, keyed by segment id. Nothing goes live. */
  rehearsal?: Record<string, PublicActivity>
  onExit?: () => void
}) {
  const router = useRouter()
  const rehearsing = !!rehearsal
  const meeting = state.meeting
  const agenda = meeting.agenda
  const live = rehearsing || meetingLive(meeting)
  const ended = !rehearsing && !!meeting.endedAt
  const local = rehearsing || !meeting.presenterReady
  const posKey = localKey(meeting.cycleId, rehearsing)
  // Kers' Boss Round intro (its first 20 s) and rehearsal's sample answers; nothing on screen counts time.
  const t = useSecond(live, now, serverNow)
  // Hold the floating slot so no install or push prompt lands on the share.
  useOverlaySlot('presenter', OVERLAY_PRIORITY.presenter, true)

  const [localPos, setLocalPos] = useState<LocalPos | null>(null)
  useEffect(() => {
    if (!local) return
    const id = setTimeout(() => setLocalPos(readLocal(posKey)), 0)
    return () => clearTimeout(id)
  }, [local, posKey])

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

  // Rehearsal: opening and closing happen here only, and the phone preview's answers stay here.
  const [rehearsed, setRehearsed] = useState<RehearsedState>({})
  const [phone, setPhone] = useState(true)
  const [mine, setMine] = useState<Record<string, Record<string, unknown>[]>>({})
  const onAnswer = useCallback((id: string, values: Record<string, unknown>[]) => setMine(m => ({ ...m, [id]: values })), [])
  const act: Call = useCallback(
    async (action, payload = {}, done) => {
      if (!rehearsing) return call(action, payload, done)
      const id = String(payload.activity_id ?? '')
      const seg = Object.values(rehearsal ?? {}).find(a => a.id === id)?.segmentId
      if (seg && action === 'open_activity') setRehearsed(r => ({ ...r, [seg]: { status: 'open', openedAt: new Date(now()).toISOString() } }))
      if (seg && action === 'close_activity') setRehearsed(r => ({ ...r, [seg]: { status: 'closed', openedAt: r[seg]?.openedAt ?? new Date(now()).toISOString() } }))
      return null
    },
    [rehearsing, rehearsal, call, now],
  ) as Call

  const segmentId = local ? localPos?.segment : meeting.currentSegment
  const idx = Math.max(0, agenda.findIndex(s => s.id === segmentId))
  const seg: Segment | undefined = agenda[idx]
  const sample = rehearsing && seg && rehearsal[seg.id] ? rehearseActivity(rehearsal[seg.id], rehearsed[seg.id], t, REHEARSE_ROOM) : null
  const activity = !live || !seg ? null : rehearsing ? (sample ? withAnswer(sample, mine[sample.id]) : null) : segmentActivity(state, seg)
  const participants = rehearsing ? REHEARSE_ROOM : state.room?.participants ?? 0
  const boss = activity ? bossPhase(activity, t) : null
  const presenting = rehearsing || (live && (local || meeting.presenterId === state.me))
  const last = idx === agenda.length - 1

  const go = useCallback(
    (to: number) => {
      if (!presenting || to < 0 || to >= agenda.length || to === idx) return
      const at = new Date(now()).toISOString()
      const segment = agenda[to].id
      if (local) {
        const pos = { segment, at }
        setLocalPos(pos)
        try { localStorage.setItem(posKey, JSON.stringify(pos)) } catch {}
        // As the API does: moving on closes what was open.
        if (rehearsing) setRehearsed(r => Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v.status === 'open' ? { ...v, status: 'closed' as const } : v])))
        return
      }
      optimistic({ currentSegment: segment, segmentStartedAt: at })
      call('goto', { segment })
    },
    [presenting, agenda, idx, now, local, posKey, rehearsing, optimistic, call],
  )

  const start = async () => {
    const warning = earlyStartWarning(state.cycle.meeting_at, now())
    if (warning && !window.confirm(warning)) return
    const data = await call('start')
    if (data && local && agenda[0]) {
      const pos = { segment: agenda[0].id, at: new Date(now()).toISOString() }
      setLocalPos(pos)
      try { localStorage.setItem(posKey, JSON.stringify(pos)) } catch {}
    }
  }
  const end = () => call('end', {}, 'Meeting ended: the recap is on the Run tab')
  const leave = useCallback(() => {
    if (onExit) onExit()
    else router.push('/admin/run/meeting')
  }, [onExit, router])

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
      if ((e.target as HTMLElement)?.closest?.('input, textarea, select, [contenteditable]')) return
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(idx + 1) }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(idx - 1) }
      else if (e.key === 'Escape' && !document.fullscreenElement) leave()
      else if (e.key === 'f' || e.key === 'F') fullscreen()
      else if (e.key === 'p' || e.key === 'P') toggleNotes()
      else if ((e.key === 'm' || e.key === 'M') && rehearsing) setPhone(on => !on)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, idx, leave, fullscreen, toggleNotes, rehearsing])

  if (!agenda.length || !seg) {
    return (
      <Shell>
        <div className="m-auto max-w-md text-center">
          <p className="font-serif text-[40px] leading-tight text-ink">No agenda yet.</p>
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
      {/* ─── Header: the board's chrome, quiet ─── */}
      <header className="flex h-16 shrink-0 items-center gap-4 px-10">
        <Wordmark />
        <span aria-hidden className="h-5 w-px bg-border-strong" />
        <p className="eyebrow">{state.cycle.label} guild meeting</p>
        {rehearsing && <span className="inline-flex h-7 items-center rounded-full bg-fill px-3 text-footnote text-ink-soft">Rehearsal · nothing is live</span>}
        {ended && <span className="inline-flex h-7 items-center rounded-full bg-fill px-3 text-footnote text-ink-soft">Ended</span>}
        <div className="ml-auto flex items-center gap-6">
          {live && <RoomPresence count={participants} />}
          <div className={cn('flex items-center gap-1.5', presenting && 'opacity-40 transition-opacity duration-200 hover:opacity-100 focus-within:opacity-100')}>
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
            {live && local && !rehearsing && <span className="mr-1.5 text-footnote text-ink-muted">Apply migration 045 so other admins can follow along</span>}
            {rehearsing && (
              <Button variant="ghost" onClick={() => setPhone(on => !on)} aria-pressed={phone} title="M">{phone ? 'Hide phone' : 'Phone preview'}</Button>
            )}
            {presenting && seg.prep?.points.length ? (
              <Button variant="ghost" onClick={toggleNotes} aria-pressed={notes} title="P">{notes ? 'Hide notes' : 'Notes'}</Button>
            ) : null}
            {presenting && !rehearsing && !last && <Button variant="ghost" icon={Stop} disabled={!!busy} onClick={end}>End</Button>}
            <Button variant="ghost" icon={isFull ? ArrowsIn : ArrowsOut} onClick={fullscreen} aria-label={isFull ? 'Leave full screen' : 'Full screen'} />
            <Link href="/admin/run/meeting" className="press inline-flex h-8 items-center rounded-full px-3 text-footnote text-ink-muted hover:bg-kinu/60 hover:text-ink">
              Esc
            </Link>
          </div>
        </div>
      </header>

      {/* ─── Stage ─── */}
      <main aria-live="polite" className="mx-auto flex min-h-0 w-full max-w-[1280px] flex-1 flex-col px-10 pb-6 pt-6">
        {ended ? (
          <div className="my-auto">
            <h1 className="text-[clamp(40px,2.9vw,56px)] font-semibold leading-[1.08] tracking-[-0.03em] text-ink">
              That’s the meeting.
            </h1>
            <Link href="/admin/run#run-recap" className="mt-8 inline-block text-[17px] text-ink underline underline-offset-4">Write the recap</Link>
          </div>
        ) : hero ? (
          <ActivityHero key={hero.id} segment={seg} activity={hero} participants={participants} presenting={presenting} now={now} call={act} busy={rehearsing ? null : busy} />
        ) : (
          <div key={seg.id} className="animate-fade-up flex min-h-0 flex-1 flex-col">
            <div className="my-auto">
              <p className="eyebrow">{KIND_LABELS[seg.kind]}</p>
              <h1
                className={cn(
                  'mt-3 max-w-[30ch] font-semibold tracking-[-0.03em] text-ink text-balance',
                  longTitle ? 'text-[clamp(36px,2.5vw,48px)] leading-[1.12]' : 'text-[clamp(40px,2.9vw,56px)] leading-[1.08]',
                )}
              >
                {seg.title}
              </h1>
              {opener ? (
                <blockquote className="mt-6 max-w-[46rem] rounded-2xl rounded-bl-md border border-border bg-sumi px-5 py-3.5 text-[clamp(18px,1.12vw,22px)] leading-[1.45] text-ink-soft text-pretty">
                  {opener}
                </blockquote>
              ) : seg.detail ? (
                <p className="mt-6 max-w-[60ch] text-[clamp(18px,1.15vw,22px)] leading-relaxed text-ink-soft">{seg.detail}</p>
              ) : null}

              {!live && !ended && (
                <div className="mt-8 flex items-center gap-3">
                  <Button icon={Play} disabled={!!busy} onClick={start}>{busy === 'start' ? 'Starting…' : 'Start meeting mode'}</Button>
                  <Link href="/meet/present?rehearse=1" className="press inline-flex h-8 items-center rounded-full bg-kinu/70 px-3 text-footnote font-medium text-ink-soft hover:bg-kinu hover:text-ink">Rehearse</Link>
                  <p className="ml-3 text-footnote text-ink-muted">The room opens on everyone’s phone when you start.</p>
                </div>
              )}
              {ready && (
                <div className="mt-8">
                  <ActivityReady activity={ready} presenting={presenting} call={act} busy={rehearsing ? null : busy} />
                </div>
              )}
            </div>

            {segPosts.length > 0 && (
              <ul className="grid shrink-0 gap-4 pt-8" style={{ gridTemplateColumns: `repeat(${Math.min(segPosts.length, 3)}, minmax(0, 28rem))` }}>
                {segPosts.map(p => (
                  <li key={p.id} className="elev-1 rounded-(--radius-card) px-5 py-4">
                    <p className="eyebrow">From the board</p>
                    <p className="mt-1.5 line-clamp-2 text-heading text-ink">{p.title}</p>
                    <p className="mt-2 flex items-center gap-4 text-footnote text-ink-muted">
                      <span className="inline-flex items-center gap-1.5"><Icon icon={ArrowFatUp} size="sm" /> <span className="tabular">{p.voteCount}</span></span>
                      <span className="inline-flex items-center gap-1.5"><Icon icon={ChatCircle} size="sm" /> <span className="tabular">{p.commentCount}</span></span>
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

      {/* Rehearsal only: the phone side, to tap through. Never on the live screen. */}
      {rehearsing && phone && (
        <PhonePreview
          cycleId={meeting.cycleId}
          label={state.cycle.label}
          segment={seg.id}
          activity={activity?.status === 'open' ? activity : null}
          participants={participants}
          mine={mine}
          onAnswer={onAnswer}
        />
      )}

      {/* ─── The line, the arrows, Kers ─── */}
      <footer className="flex h-20 shrink-0 items-center gap-5 pl-10 pr-6">
        {presenting && <NavArrow label="Back" icon={CaretLeft} disabled={idx === 0} onClick={() => go(idx - 1)} />}
        <AgendaProgress agenda={agenda} index={idx} onPick={presenting ? go : undefined} className="min-w-0 flex-1" />
        {presenting && (last ? (
          rehearsing ? (
            <Button variant="secondary" onClick={leave}>Done rehearsing</Button>
          ) : (
            <Button variant="secondary" icon={Stop} disabled={!!busy} onClick={end}>End meeting</Button>
          )
        ) : (
          <NavArrow label="Next" icon={CaretRight} onClick={() => go(idx + 1)} />
        ))}
        <PresenterKers className="-mb-2 ml-3 shrink-0" segmentKey={seg.id} live={live} ended={ended} boss={boss} />
      </footer>
    </Shell>
  )
}

/**
 * Who's in, without who: a stack of the board's avatars from anonymous
 * seeds (seat 1, seat 2…), never anyone's name, and the count.
 */
function RoomPresence({ count }: { count: number }) {
  const shown = Math.min(count, 6)
  return (
    <div className="flex items-center gap-3" aria-label={`${count} in the room`}>
      {shown > 0 && (
        <span aria-hidden className="flex">
          {Array.from({ length: shown }, (_, i) => (
            <UserAvatar key={i} username={`guild-seat-${i * 7 + 3}`} size={22} className={cn('rounded-full ring-2 ring-parchment', i > 0 && '-ml-2')} />
          ))}
        </span>
      )}
      <span className="text-footnote text-ink-soft">
        <span className="num text-ink">{count}</span> in the room
      </span>
    </div>
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
  return <div className="fixed inset-0 z-(--z-overlay) flex flex-col bg-parchment text-ink [&_.eyebrow]:text-[13px]!">{children}</div>
}
