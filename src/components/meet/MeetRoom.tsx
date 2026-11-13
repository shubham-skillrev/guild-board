'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Kers } from '@/components/kers/Kers'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Wordmark } from '@/components/ui/Wordmark'
import { OVERLAY_PRIORITY, useOverlaySlot } from '@/components/ui/OverlaySlot'
import { useToast } from '@/hooks/useToast'
import { useAuth } from '@/hooks/useAuth'
import { PhoneActivity } from '@/components/meet/PhoneActivity'
import { ActivityResults } from '@/components/meet/ActivityPanel'
import { SegmentCards, SlideText } from '@/components/meet/SegmentCards'
import { MemeSlide } from '@/components/meet/MemeSlide'
import { SURVEY_PATH, TopicBody, topicPost } from '@/components/meet/TopicBody'
import { activityKeyFor, isRealCard, sectionsOf, slideKind, type MeetPost, type PresenterNotes, type PublicSegment } from '@/lib/meeting'
import { newerRoom, useMeetingChannel } from '@/components/meet/useMeetingChannel'
import type { MeetView, Mine, PublicActivity, RoomState } from '@/lib/meet/activity'
import { clockSkew } from '@/lib/meet/timer'

/** Without the live channel. With it, a slow poll still catches anything missed. */
const POLL_MS = 3000
const SLOW_POLL_MS = 30_000

/** What changed in the room that needs this person's own state pulled: the activity, and a rehearsal starting or ending. */
const roomKey = (r: RoomState | null | undefined) => (r?.activity ? `${r.activity.id}:${r.activity.status}` : '') + (r?.rehearsal ? ':r' : '')

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
 *   a slide      what's on the shared screen now (PhoneSlide), by its kind:
 *                a title's "next up", a content slide's cards (news opens
 *                its source, a post its board page) and plain text, a
 *                results slide's results, a big line, a meme. An activity
 *                opening swaps it in; closing it swaps the slide back
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
 * Rehearsal's phone preview (PhonePreview) runs the room with no network:
 * `post` answers in place of POST /api/meet, `room` stands in for the
 * broadcast, nothing is polled and no channel is joined.
 */
export interface MeetRoomOffline {
  /** Answers as POST /api/meet would: the joined view, or `{ mine }`, `{ blocked, message }`. */
  post: typeof post
  room?: RoomState | null
}

export function MeetRoom({ initial, offline }: { initial: MeetView; offline?: MeetRoomOffline }) {
  const toast = useToast()
  const { isAdmin } = useAuth()
  const [view, setView] = useState(initial)
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState<string | null>(null)
  const room = view.room
  // A live rehearsal opens the room only to a phone that holds its code (the server says so in `view.rehearsal`).
  const rehearsal = !room?.live && !!room?.rehearsal && !!view.rehearsal
  const live = !!room?.live || rehearsal
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

  // How far the server's clock is ahead of this one (the room's `at` on each pull), so the countdown matches the screen.
  const skew = useRef(0)
  const initialAt = initial.room?.at
  useEffect(() => {
    skew.current = clockSkew(initialAt, Date.now())
  }, [initialAt])
  const now = useCallback(() => Date.now() + skew.current, [])

  const isOffline = !!offline
  const refresh = useCallback(async () => {
    if (isOffline) return
    const before = writes.current
    try {
      const sent = Date.now()
      const res = await fetch('/api/meet', { cache: 'no-store' })
      if (!res.ok) return
      const next: MeetView = await res.json()
      // The server read the room somewhere in the round trip: assume halfway.
      if (next.room?.at) skew.current = clockSkew(next.room.at, (sent + Date.now()) / 2)
      const stale = before !== writes.current || pending.current > 0
      // A broadcast may have brought a newer room than this pull.
      setView(v => ({ ...next, room: next.room && v.room ? newerRoom(v.room, next.room) : next.room, mine: stale ? v.mine : next.mine }))
    } catch {
      /* offline for a moment */
    }
  }, [isOffline])

  // A new activity (or one reopened) needs this person's answers to it: pull once.
  const shownKey = useRef(roomKey(room))
  const onRoom = useCallback(
    (next: RoomState) => {
      const key = roomKey(next)
      setView(v => ({ ...v, room: newerRoom(v.room, next) }))
      if (key !== shownKey.current) {
        shownKey.current = key
        // Closed too: the results mark this person's own vote ("you picked").
        if (next.activity || !next.live) refresh()
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

  // Warm the API on load (the function, the session check): the first vote then isn't the one paying for a cold start.
  useEffect(() => {
    if (isOffline) return
    const id = setTimeout(refresh, 0)
    return () => clearTimeout(id)
  }, [isOffline, refresh])

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
      <Notice kers="sleepy" title="No meeting on right now." text={isAdmin ? 'This is the room people join on their phones. It opens when you start meeting mode from the presenter screen.' : 'When the guild meets, the room opens here.'}>
        {isAdmin ? (
          <div className="mt-6 flex justify-center gap-2">
            <Link href="/meet/present?rehearse=1" className="press inline-flex h-8 items-center rounded-full bg-kinu/70 px-3.5 text-footnote font-medium text-ink-soft hover:bg-kinu hover:text-ink">Preview alone</Link>
            <Link href="/meet/present" className="press inline-flex h-8 items-center rounded-full bg-ink px-3.5 text-footnote font-medium text-parchment hover:bg-ink/85">Presenter screen</Link>
          </div>
        ) : (
          <Link href="/board" className="mt-6 inline-block text-footnote text-ink underline underline-offset-2">Back to the board</Link>
        )}
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
          <PhoneActivity key={room.activity.id} activity={room.activity} mine={view.mine?.activityId === room.activity.id ? view.mine : null} onMine={setMine} post={send} toast={toast} now={now} onExpire={isOffline ? undefined : refresh} />
          {notes && <YourNotes notes={notes} />}
        </div>
      )
    } else if (seg) {
      // This slide's activity (an activity slide's own, a results slide's `of`), closed or not yet open.
      const key = activityKeyFor(view.agenda!, seg.id)
      const mineAct = room?.activity && room.activity.segmentId === key ? room.activity : null
      body = (
        <div key={`seg-${seg.id}:${mineAct?.status ?? ''}`} className="gb-swap-in">
          <PhoneSlide seg={seg} agenda={view.agenda!} index={segIdx} posts={view.posts ?? {}} notes={notes} activity={mineAct} mine={pickOf(view.mine, mineAct)} />
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
    <div className="@container flex min-h-dvh flex-col bg-parchment text-ink">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
        <Link href="/" aria-label="GuildBoard by SkillRev, home" className="press">
          <Wordmark />
        </Link>
        {live && room && (
          <p className="ml-auto text-footnote text-ink-muted"><span className="tabular text-ink">{room.participants}</span> in the room</p>
        )}
      </header>
      <main className="mx-auto flex w-full max-w-[440px] flex-1 flex-col px-4 py-8 @3xl:max-w-[1100px] @3xl:px-10 @3xl:py-12">
        {view.label && live && <p className="font-mono text-[12px] uppercase tracking-[0.16em] text-ink-muted">{view.label} guild meeting{rehearsal ? ' · rehearsal' : ''}</p>}
        {rehearsal && (
          <p className="mt-2 inline-flex w-fit items-center rounded-full bg-fill px-3 py-1 text-footnote text-ink-soft">Rehearsal · answers are deleted afterwards</p>
        )}
        {joined && view.joined?.kind === 'guest' && view.joined.name && (
          <p className="mt-1 text-footnote text-ink-muted">You’re in as {view.joined.name}. Only you see that.</p>
        )}
        <div className="flex flex-1 flex-col">{body}</div>
      </main>
    </div>
  )
}

/**
 * The slide on the shared screen, on the phone, by its kind. Real cards are
 * tappable (a source, a board post, in a new tab); the next section is a
 * line at the bottom so nobody wonders what's coming.
 */
function PhoneSlide({ seg, agenda, index, posts, notes, activity, mine }: { seg: PublicSegment; agenda: PublicSegment[]; index: number; posts: Record<string, MeetPost>; notes: PresenterNotes[string] | null; activity: PublicActivity | null; mine: number | null }) {
  const kind = slideKind(seg, !!activity)
  const sections = sectionsOf(agenda)
  const here = sections.findIndex(x => index >= x.start && index < x.start + x.slides)
  const last = index === agenda.length - 1
  const real = seg.cards.filter(isRealCard)
  const topic = kind === 'content' ? topicPost(seg.cards, posts) : null
  const eyebrow = (text: string) => (
    <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-muted">
      <span className="relative flex size-1.5" aria-hidden>
        <span className="absolute inset-0 rounded-full bg-matcha opacity-60 motion-safe:animate-ping" />
        <span className="relative size-1.5 rounded-full bg-matcha" />
      </span>
      {text}
    </p>
  )
  let main: React.ReactNode
  if (kind === 'meme' && seg.meme) {
    main = <div className="pt-6"><MemeSlide meme={seg.meme} size="phone" /></div>
  } else if (kind === 'title') {
    main = (
      <div className="flex flex-col items-center pt-10 text-center">
        <Kers size={96} colour="meeting" expression="excited" motion="hop" special="happy" />
        {sections[here] && sections[here].title !== seg.title && <p className="mt-6 font-mono text-[11px] uppercase tracking-[0.16em] text-ink-muted">{sections[here].title}</p>}
        <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-[-0.025em] text-ink text-balance @3xl:text-[48px]">{seg.title}</h1>
        {seg.cue && <p className="mt-3 max-w-[30ch] text-[15px] leading-relaxed text-ink-soft text-pretty @3xl:max-w-[46ch] @3xl:text-[20px]">{seg.cue}</p>}
      </div>
    )
  } else if (kind === 'text') {
    main = (
      <div className="pt-8">
        <h1 className="text-[30px] font-semibold leading-[1.1] tracking-[-0.03em] text-ink text-balance @3xl:text-[52px]">{seg.title}</h1>
        {seg.cue && <p className="mt-3 text-[16px] leading-relaxed text-ink-soft text-pretty @3xl:text-[21px]">{seg.cue}</p>}
        {last && (
          <a href={SURVEY_PATH} target="_blank" rel="noopener noreferrer" className="press mt-8 inline-flex h-11 items-center rounded-full bg-ink px-5 text-[15px] font-medium text-parchment hover:bg-ink/85">
            Fill the 2-minute survey
          </a>
        )}
      </div>
    )
  } else if (kind === 'activity' || kind === 'results') {
    main = (
      <div className="pt-5">
        {eyebrow(kind === 'results' ? 'Results on screen' : activity?.status === 'closed' ? 'Closed' : 'Opens in a moment')}
        <h1 className="mt-2 text-[24px] font-semibold leading-tight tracking-[-0.02em] text-ink text-balance @3xl:text-[36px]">{kind === 'results' ? seg.cue || seg.title : activity?.prompt ?? seg.title}</h1>
        {activity && activity.status !== 'ready' && <div className="mt-5"><ActivityResults activity={activity} mine={mine} /></div>}
      </div>
    )
  } else if (topic) {
    main = (
      <div>
        <TopicBody post={topic} eyebrow={sections[here]?.title ?? null} size="phone" />
        <SlideText cards={seg.cards} size="phone" className="mt-5" />
      </div>
    )
  } else {
    main = (
      <div className="pt-5">
        {eyebrow(sections[here]?.title ?? 'On screen now')}
        {seg.title && <h1 className="mt-2 text-[24px] font-semibold leading-tight tracking-[-0.02em] text-ink text-balance @3xl:text-[36px]">{seg.title}</h1>}
        {seg.cue && <p className="mt-2 text-[15px] leading-relaxed text-ink-soft text-pretty">{seg.cue}</p>}
        {real.length > 0 && <SegmentCards cards={real} posts={posts} size="phone" className="mt-5" />}
        <SlideText cards={seg.cards} size="phone" className="mt-5" />
        {!seg.cards.length && seg.detail && <p className="mt-4 text-[15px] leading-relaxed text-ink-soft">{seg.detail}</p>}
      </div>
    )
  }
  return (
    <section aria-label={`Now: ${seg.title || 'on screen'}`}>
      {/* The presenter's own phone: their notes first, it's what they glance at. */}
      {notes && <YourNotes notes={notes} />}
      {main}
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

/** This person's poll vote on `activity`, for "you picked" on its results. */
function pickOf(mine: Mine | null | undefined, activity: PublicActivity | null): number | null {
  if (!activity || activity.kind !== 'poll' || mine?.activityId !== activity.id) return null
  const o = mine.values[0]?.option
  return typeof o === 'number' ? o : null
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
