'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Kers } from '@/components/kers/Kers'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Wordmark } from '@/components/ui/Wordmark'
import { OVERLAY_PRIORITY, useOverlaySlot } from '@/components/ui/OverlaySlot'
import { useToast } from '@/hooks/useToast'
import { PhoneActivity, type PhoneDemo } from '@/components/meet/PhoneActivity'
import { ActivityResults } from '@/components/meet/ActivityPanel'
import { SegmentCards } from '@/components/meet/SegmentCards'
import { KIND_LABELS, type MeetPost, type PresenterNotes, type PublicSegment } from '@/lib/meeting'
import { newerRoom, useMeetingChannel } from '@/components/meet/useMeetingChannel'
import type { MeetView, Mine, PublicActivity, RoomState } from '@/lib/meet/activity'

/** Without the live channel. With it, a slow poll still catches anything missed. */
const POLL_MS = 3000
const SLOW_POLL_MS = 30_000

async function post(body: Record<string, unknown>) {
  const res = await fetch('/api/meet', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Could not do that')
  return data
}

/**
 * The room on a phone or laptop (/meet).
 *
 *   not live     Kers asleep: the room opens when the meeting does
 *   joining      members go straight in (one automatic join under their
 *                account); guests type a name first
 *   activity     the open poll, word cloud or Boss Round (PhoneActivity)
 *   between      what's on the shared screen now (PhoneSegment): the
 *                segment's title, cue and cards (news opens its source, a
 *                post its board page), and what's next. An activity opening
 *                swaps it in; closing it swaps the cards back
 *   waiting      "Kers is setting up…": only with no agenda to show
 *
 * The presenter's own phone also shows "Your notes" (the opener and talking
 * points): the server sends them to that one person only (MeetView.notes).
 *
 * The room arrives on `meeting:{cycle_id}` (at most once a second); while the
 * channel is down it's polled every 3 s. Nothing here shows anyone else's
 * name, and the shared screen never shows this person's.
 */
/**
 * The dev mock (/meet/mock) runs the room with no network: `post` answers in
 * place of POST /api/meet, `room` stands in for the broadcast, nothing is
 * polled and no channel is joined. `demo` seeds a phone's local state.
 */
export interface MeetRoomOffline {
  /** Answers as POST /api/meet would: the joined view, or `{ mine }`, `{ blocked, message }`. */
  post: typeof post
  room?: RoomState | null
  demo?: PhoneDemo
}

export function MeetRoom({ initial, offline }: { initial: MeetView; offline?: MeetRoomOffline }) {
  const toast = useToast()
  const [view, setView] = useState(initial)
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const room = view.room
  const live = !!room?.live
  const joined = !!view.joined
  // Hold the floating slot: no install or push prompt over a poll, the join form or the waiting room.
  useOverlaySlot('meet-room', OVERLAY_PRIORITY.presenter, true)

  // Answers sent, and still on their way. A pull that left before one (or
  // while one is out) has stale answers, so it keeps the ones on screen.
  const writes = useRef(0)
  const pending = useRef(0)
  const doPost = offline?.post ?? post
  const send = useCallback(async (body: Record<string, unknown>) => {
    writes.current++
    pending.current++
    try {
      return await doPost(body)
    } finally {
      pending.current--
    }
  }, [doPost])

  const isOffline = !!offline
  const refresh = useCallback(async () => {
    if (isOffline) return
    const before = writes.current
    try {
      const res = await fetch('/api/meet', { cache: 'no-store' })
      if (!res.ok) return
      const next: MeetView = await res.json()
      const stale = before !== writes.current || pending.current > 0
      // A broadcast may have brought a newer room than this pull.
      setView(v => ({ ...next, room: next.room && v.room ? newerRoom(v.room, next.room) : next.room, mine: stale ? v.mine : next.mine }))
    } catch {
      /* offline for a moment */
    }
  }, [isOffline])

  // A new activity (or one reopened) needs this person's answers to it: pull once.
  const shownKey = useRef(room?.activity ? `${room.activity.id}:${room.activity.status}` : '')
  const onRoom = useCallback(
    (next: RoomState) => {
      const key = next.activity ? `${next.activity.id}:${next.activity.status}` : ''
      setView(v => ({ ...v, room: newerRoom(v.room, next) }))
      if (key !== shownKey.current) {
        shownKey.current = key
        if (next.activity?.status === 'open' || !next.live) refresh()
      }
    },
    [refresh],
  )
  const { connected } = useMeetingChannel(isOffline ? null : view.cycleId, onRoom)

  // Offline: the room handed in plays the broadcast.
  const offlineRoom = offline?.room
  useEffect(() => {
    if (offlineRoom) onRoom(offlineRoom)
  }, [offlineRoom, onRoom])

  useEffect(() => {
    if (isOffline) return
    const tick = () => { if (!document.hidden) refresh() }
    const id = setInterval(tick, connected ? SLOW_POLL_MS : POLL_MS)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [connected, refresh, isOffline])

  const join = useCallback(
    async (name?: string) => {
      setJoining(true)
      setJoinError(null)
      try {
        setView(await doPost({ action: 'join', name }))
      } catch (err) {
        setJoinError(err instanceof Error ? err.message : 'Could not join')
      } finally {
        setJoining(false)
      }
    },
    [doPost],
  )

  // Members go straight in: one automatic join, under their account.
  const autoJoined = useRef(false)
  useEffect(() => {
    if (!live || joined || !view.member || autoJoined.current) return
    autoJoined.current = true
    const id = setTimeout(() => join(), 0)
    return () => clearTimeout(id)
  }, [live, joined, view.member, join])

  const setMine = useCallback((mine: Mine) => setView(v => ({ ...v, mine })), [])

  let body: React.ReactNode
  if (!live) {
    body = (
      <Notice kers="sleepy" title="No meeting on right now." text="When the guild meets, the room opens here.">
        <Link href="/board" className="mt-6 inline-block text-footnote text-ink underline underline-offset-2">Back to the board</Link>
      </Notice>
    )
  } else if (!view.ready) {
    body = <Notice kers="sleepy" title="The room isn’t set up yet." text="Watch the shared screen for now. (An admin needs to apply migration 046.)" />
  } else if (!joined) {
    body = view.member ? (
      <Notice kers="excited" title={joining ? `Joining as @${view.member}…` : `Join as @${view.member}`} text="You’ll vote and add words from here. The shared screen never shows who answered.">
        {!joining && (
          <Button className="mt-6" onClick={() => join()}>Join the room</Button>
        )}
        {joinError && <p role="alert" className="mt-3 text-footnote text-vermillion">{joinError}</p>}
      </Notice>
    ) : (
      <GuestJoin busy={joining} error={joinError} onJoin={join} />
    )
  } else {
    const segIdx = view.agenda?.findIndex(s => s.id === room?.segment) ?? -1
    const seg = segIdx >= 0 ? view.agenda![segIdx] : null
    const notes = seg ? view.notes?.[seg.id] ?? null : null
    if (room?.activity?.status === 'open') {
      body = (
        <div key={`act-${room.activity.id}`} className="gb-swap-in">
          <PhoneActivity key={room.activity.id} activity={room.activity} mine={view.mine?.activityId === room.activity.id ? view.mine : null} onMine={setMine} post={send} toast={toast} demo={offline?.demo} />
          {notes && <YourNotes notes={notes} />}
        </div>
      )
    } else if (seg) {
      const closed = room?.activity?.status === 'closed' && room.activity.segmentId === seg.id ? room.activity : null
      body = (
        <div key={`seg-${seg.id}:${closed?.id ?? ''}`} className="gb-swap-in">
          <PhoneSegment seg={seg} index={segIdx} count={view.agenda!.length} next={view.agenda![segIdx + 1] ?? null} posts={view.posts ?? {}} notes={notes} results={closed} />
        </div>
      )
    } else if (!room?.warm) {
      body = <Notice kers="thinking" title="Kers is setting up…" text={people(room?.participants ?? 0)} />
    } else {
      const verdict = room?.activity?.kind === 'boss' && room.activity.status === 'closed'
      body = <Notice kers="watching" title="Watch the screen." text={verdict ? 'The round is closed. Kers’ verdict is on the screen.' : 'The next poll or word cloud shows up here when it opens.'} />
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-parchment text-ink">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
        <Link href="/" aria-label="GuildBoard by SkillRev, home" className="press">
          <Wordmark />
        </Link>
        {live && room && (
          <p className="ml-auto text-footnote text-ink-muted"><span className="tabular text-ink">{room.participants}</span> in the room</p>
        )}
      </header>
      <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col px-4 py-8">
        {view.label && live && <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-ink-muted">{view.label} guild meeting</p>}
        {joined && view.joined?.kind === 'guest' && view.joined.name && (
          <p className="mt-1 text-footnote text-ink-muted">You’re in as {view.joined.name}. Only you see that.</p>
        )}
        <div className="flex flex-1 flex-col">{body}</div>
      </main>
    </div>
  )
}

/**
 * Between activities: what the shared screen shows, on the phone. The cards
 * are tappable (a source, a board post, in a new tab), and the next segment
 * is a line at the bottom so nobody wonders what's coming.
 */
function PhoneSegment({ seg, index, count, next, posts, notes, results }: { seg: PublicSegment; index: number; count: number; next: PublicSegment | null; posts: Record<string, MeetPost>; notes: PresenterNotes[string] | null; results: PublicActivity | null }) {
  return (
    <section aria-label={`Now: ${seg.title}`} className="pt-5">
      <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-muted">
        <span className="relative flex size-1.5" aria-hidden>
          <span className="absolute inset-0 rounded-full bg-matcha opacity-60 motion-safe:animate-ping" />
          <span className="relative size-1.5 rounded-full bg-matcha" />
        </span>
        On screen now · {KIND_LABELS[seg.kind]} · <span className="tabular">{index + 1}/{count}</span>
      </p>
      <h1 className="mt-2 text-[24px] font-semibold leading-tight tracking-[-0.02em] text-ink text-balance">{seg.title}</h1>
      {seg.cue && <p className="mt-2 text-[15px] leading-relaxed text-ink-soft text-pretty">{seg.cue}</p>}
      {/* The presenter's own phone: their notes first, it's what they glance at. */}
      {notes && <YourNotes notes={notes} />}
      {results && <div className="mt-4"><ActivityResults activity={results} size="phone" /></div>}
      {seg.cards.length > 0 ? (
        <SegmentCards cards={seg.cards} posts={posts} size="phone" className="mt-5" />
      ) : seg.detail ? (
        <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">{seg.detail}</p>
      ) : null}
      <p className="mt-8 border-t border-border pt-4 text-footnote text-ink-muted">
        {next ? <>Up next: <span className="text-ink-soft">{next.title}</span></> : 'Last one. Thanks for coming.'}
      </p>
      <p className="mt-1 text-footnote text-ink-muted">Polls and word clouds open here when the presenter starts them.</p>
    </section>
  )
}

/** The presenter's own phone only: what to say and raise (never on the shared screen). */
function YourNotes({ notes }: { notes: PresenterNotes[string] }) {
  if (!notes.opener && !notes.points.length) return null
  return (
    <aside aria-label="Your notes" className="mt-4 rounded-(--radius-card) border border-dashed border-border-strong bg-sumi/60 px-4 py-3.5">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-muted">Your notes · only you see these</p>
      {notes.opener && <p className="mt-2 text-[14px] leading-relaxed text-ink"><span className="font-medium">Say: </span>{notes.opener}</p>}
      {notes.points.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {notes.points.map((p, i) => (
            <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed text-ink-soft">
              <span aria-hidden className="mt-[0.65em] size-1 shrink-0 rounded-full bg-ink-muted" />
              {p}
            </li>
          ))}
        </ul>
      )}
    </aside>
  )
}

function people(n: number) {
  return n === 1 ? 'Just you in the room so far.' : `${n} people in the room.`
}

type KersLook = 'sleepy' | 'excited' | 'thinking' | 'watching'

function Notice({ kers, title, text, children }: { kers: KersLook; title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="m-auto flex flex-col items-center py-10 text-center" aria-live="polite">
      <Kers
        size={112}
        colour="meeting"
        expression={kers === 'sleepy' ? 'sleepy' : kers === 'watching' ? 'nosy' : 'excited'}
        state={kers === 'thinking' ? 'thinking' : null}
        motion={kers === 'sleepy' ? 'still' : 'idle'}
      />
      <p className="mt-6 text-[22px] font-semibold tracking-[-0.02em] text-ink">{title}</p>
      <p className="mt-2 max-w-[32ch] text-footnote text-ink-muted">{text}</p>
      {children}
    </div>
  )
}

function GuestJoin({ busy, error, onJoin }: { busy: boolean; error: string | null; onJoin: (name: string) => void }) {
  const [name, setName] = useState('')
  return (
    <form
      className="m-auto flex w-full flex-col items-center py-10 text-center"
      onSubmit={e => {
        e.preventDefault()
        if (name.trim()) onJoin(name.trim())
      }}
    >
      <Kers size={96} colour="meeting" expression="excited" />
      <p className="mt-6 text-[22px] font-semibold tracking-[-0.02em] text-ink">Join the room</p>
      <p className="mt-2 max-w-[32ch] text-footnote text-ink-muted">What should Kers call you? Your name stays here: the shared screen never shows who answered.</p>
      <label htmlFor="meet-name" className="sr-only">Your name</label>
      <div className="mt-6 flex w-full gap-2">
        <Input
          id="meet-name"
          value={name}
          onChange={e => setName(e.target.value)}
          maxLength={40}
          autoComplete="given-name"
          placeholder="Your name"
          className="h-8 min-w-0 flex-1 pointer-coarse:h-11"
        />
        <Button type="submit" disabled={busy || !name.trim()}>{busy ? 'Joining…' : 'Join'}</Button>
      </div>
      {error && <p role="alert" className="mt-3 text-footnote text-vermillion">{error}</p>}
      <Link href="/login" className="mt-6 text-footnote text-ink-muted underline underline-offset-2 hover:text-ink">Have an account? Sign in</Link>
    </form>
  )
}
