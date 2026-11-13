'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowsIn, ArrowsOut, CaretLeft, CaretRight, Copy, PencilSimple, Play, QrCode, Stop } from '@phosphor-icons/react/dist/ssr'
import { Button } from '@/components/ui/Button'
import { Icon } from '@/components/ui/Icon'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { Wordmark } from '@/components/ui/Wordmark'
import { cn } from '@/lib/utils/cn'
import { OVERLAY_PRIORITY, useOverlaySlot } from '@/components/ui/OverlaySlot'
import { segmentActivity } from '@/components/meet/ActivityPanel'
import { AgendaProgress } from '@/components/meet/AgendaProgress'
import { SlideBody, TitleStage } from '@/components/meet/SlideBody'
import { SlideEditor } from '@/components/meet/SlideEditor'
import { PresenterKers } from '@/components/meet/PresenterKers'
import { bossPhase } from '@/lib/meet/boss'
import { REHEARSE_ROOM, rehearseActivity, withAnswer, type RehearsedLocal } from '@/lib/meet/rehearse'
import { closesAtFor, durationFor, expired, extendClosesAt } from '@/lib/meet/timer'
import { gotoPlan, resultsAfter } from '@/lib/meet/slides'
import { rehearsalActivities } from '@/lib/meet/agendaEdit'
import { rehearsalLeft, rehearsalOn, rehearsalPath } from '@/lib/meet/liveRehearsal'
import { useToast } from '@/hooks/useToast'
import { PhonePreview } from '@/components/meet/PhonePreview'
import { JoinQr, useOrigin } from '@/components/meet/JoinQr'
import { ReportButton } from '@/components/meet/ReportButton'
import { hideWord, unhideWord, withoutHidden, type PublicActivity } from '@/lib/meet/activity'
import { PresenterRemote } from '@/components/meet/PresenterRemote'
import { QuestionOverlay, QuestionQueue, ReactionFloats } from '@/components/meet/RoomExtras'
import type { Moderation } from '@/components/meet/ActivityPanel'
import { REMOTE_QUERY } from '@/lib/meet/clicker'
import { openCount, SAMPLE_QUESTIONS, sortQueue, type PublicQuestion } from '@/lib/meet/questions'
import { noReactions, type Reaction, type ReactionTotals } from '@/lib/meet/reactions'
import { useMeetingLive, useSecond } from '@/components/meet/useMeetingLive'
import { activityKeyFor, earlyStartWarning, meetingDone, meetingLive, presenterNotes, publicSegments, sectionsOf, slideKind, type MeetingState, type MeetPost, type Segment } from '@/lib/meeting'

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

/** Whether the presenter's notes show in rehearsal (P toggles; kept per browser). Never on the live screen. */
const NOTES_KEY = 'gb-meet-notes'

/** Whether this screen is a phone (lib/meet/clicker.ts REMOTE_QUERY): the presenter gets the remote here. */
function useRemote(): boolean {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia(REMOTE_QUERY)
    const read = () => setOn(mq.matches)
    const first = setTimeout(read, 0)
    mq.addEventListener('change', read)
    return () => {
      clearTimeout(first)
      mq.removeEventListener('change', read)
    }
  }, [])
  return on
}

/** Rehearsal's cloud without the words its presenter hid (live, the server's aggregate drops them). */
function hiddenOut(a: PublicActivity, hidden: Record<string, string[]>): PublicActivity {
  return a.words && hidden[a.id]?.length ? { ...a, words: withoutHidden(a.words, hidden[a.id]) } : a
}

/** An activity's state in rehearsal (its countdown too): local only, never sent. */
type RehearsedState = Record<string, RehearsedLocal>

/**
 * The presenter screen (/meet/present), shared full screen on the call:
 * GuildBoard on a big screen. The board's language (the serif title, the
 * mono eyebrows, cards and poll rows, Kers' chat bubble), with only what the
 * room needs to see. The meeting goes at the presenter's pace; only an open
 * activity has a clock, its countdown ring (lib/meet/timer.ts), and when it
 * runs out the server closes it and the screen moves on to its results.
 *
 *   header   the wordmark, the month, who's in the room (anonymous avatar
 *            seeds, never names); the presenter's few controls fade in on
 *            hover ("Take over" for another admin)
 *   stage    one slide (docs/06-meeting-mode.md, "Slides"), laid out by its
 *            kind: a title ("Next up", Kers bouncing), content (the board's
 *            posts and Radar news as cards, summary as plain text), an
 *            activity (ActivityHero: the question, the live count and the
 *            one saffron "Close voting"), its results (ResultsHero, big), a
 *            single big line, or a meme
 *   notes    never on the live screen: the talking points go to the
 *            presenter's own phone (/meet). In rehearsal only, they show
 *            here, small (P hides), and the phone preview is the presenter's
 *   footer   a thin line per section with a dot per slide, no text;
 *            subtle Back / Next either side, and Kers, small, at the end
 *
 * Only the presenter moves it (← → or PageUp/PageDown for a clicker, the
 * arrows, the dots); everyone else follows (the meeting channel, polling
 * as the fallback). Esc leaves, F goes full screen, Q the question queue;
 * in rehearsal P shows or hides the notes and M the phone. The place lives
 * on the server, so a refresh resumes it. On a phone the presenter gets the
 * remote instead (PresenterRemote); reactions float up from the corner and
 * a question pulled from the queue sits over the slide's foot.
 *
 * Rehearsal (`rehearsal` set, /meet/present?rehearse=1): the same screen on
 * the real agenda and prep, the day before. Nothing is live and nothing is
 * written: the place is kept in this browser, arriving on an activity slide
 * "opens" it with sample answers (lib/meet/rehearse.ts, the same gotoPlan as
 * the server), and no action reaches the API. "Preview alone".
 *
 * Live rehearsal ("Rehearse live (with phones)", `rehearse_start`): the real
 * pipeline, server and phones, but private and disposable
 * (lib/meet/liveRehearsal.ts). The screen works as live, marked "Rehearsal",
 * with the share link and "End rehearsal", which wipes every answer.
 */
export function PresenterScreen({ initial, posts, rehearsal, board, edit }: { initial: MeetingState; posts: Record<string, MeetPost>; rehearsal?: Record<string, PublicActivity>; board?: MeetPost[]; edit?: boolean }) {
  const { state, busy, call, optimistic, now, refresh } = useMeetingLive(initial)
  return <PresenterView state={state} busy={busy} call={call} optimistic={optimistic} now={now} refresh={refresh} serverNow={initial.serverNow} posts={posts} rehearsal={rehearsal} board={board} edit={edit} />
}

type Call = ReturnType<typeof useMeetingLive>['call']

/** The screen itself, from the meeting's state (PresenterScreen feeds it from the server). */
export function PresenterView({
  state,
  busy,
  call,
  optimistic,
  now,
  refresh,
  serverNow,
  posts,
  rehearsal,
  board,
  edit = false,
}: {
  state: MeetingState
  busy: string | null
  call: Call
  optimistic: (patch: Partial<MeetingState['meeting']>) => void
  now: () => number
  /** Pull the state now: the countdown hit zero, and the server closes the activity on that read. */
  refresh?: () => void
  /** The server's time in the page's props, so the first render agrees. */
  serverNow: string
  posts: Record<string, MeetPost>
  /** Rehearsal: each activity as seeded, keyed by its slide id. Nothing goes live. */
  rehearsal?: Record<string, PublicActivity>
  /** Rehearsal: this month's board posts, for the slide editor's Topic from the board. */
  board?: MeetPost[]
  /** Rehearsal: open in the slide editor (`?rehearse=1&edit=1`). */
  edit?: boolean
}) {
  const router = useRouter()
  const rehearsing = !!rehearsal
  const meeting = state.meeting
  const agenda = meeting.agenda
  // A live rehearsal: the server's, with phones. `rehearsing` is the solo preview.
  const dress = !rehearsing && rehearsalOn(meeting)
  const live = rehearsing || meetingLive(meeting) || dress
  const ended = !rehearsing && !dress && meetingDone(meeting, state.cycle.meeting_at)
  const local = rehearsing || !meeting.presenterReady
  const posKey = localKey(meeting.cycleId, rehearsing)
  // Rehearsal's activities: each activity slide's own (edits show at once), else its seeded row's.
  const rehearsalActs = useMemo(() => (rehearsal ? rehearsalActivities(agenda, rehearsal) : undefined), [rehearsal, agenda])
  // Kers' Boss Round intro (its first 20 s), rehearsal's sample answers and its countdowns.
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

  // The slide editor (rehearsal only): it replaces the screen while it's open.
  const [editing, setEditing] = useState(edit && !!rehearsal)
  const allPosts = useMemo(() => ({ ...Object.fromEntries((board ?? []).map(p => [p.id, p])), ...posts }), [board, posts])

  // Rehearsal: opening and closing happen here only, and the phone preview's answers stay here.
  const [rehearsed, setRehearsed] = useState<RehearsedState>({})
  const [phone, setPhone] = useState(true)
  const [mine, setMine] = useState<Record<string, Record<string, unknown>[]>>({})
  const onAnswer = useCallback((id: string, values: Record<string, unknown>[]) => setMine(m => ({ ...m, [id]: values })), [])
  // Rehearsal's extras, local only: sample questions (and the phone preview's), its reactions, hidden cloud words.
  const [sampleQs, setSampleQs] = useState<PublicQuestion[]>(SAMPLE_QUESTIONS)
  const [sampleShown, setSampleShown] = useState<string | null>(null)
  const [sampleVoted, setSampleVoted] = useState<string[]>([])
  const [sampleReactions, setSampleReactions] = useState<ReactionTotals>(noReactions)
  const [sampleHidden, setSampleHidden] = useState<Record<string, string[]>>({})
  const previewAsk = useCallback((text: string) => setSampleQs(qs => [...qs, { id: `local-${qs.length}-${text.length}`, text, votes: 0, answered: false, at: new Date().toISOString() }]), [])
  const previewVote = useCallback((id: string, on: boolean) => {
    setSampleVoted(v => (on ? (v.includes(id) ? v : [...v, id]) : v.filter(x => x !== id)))
    setSampleQs(qs => qs.map(q => (q.id === id ? { ...q, votes: Math.max(0, q.votes + (on ? 1 : -1)) } : q)))
  }, [])
  const previewReact = useCallback((r: Reaction) => setSampleReactions(t => ({ ...t, [r]: t[r] + 1 })), [])
  // The phone remote, unless the presenter asked for the full screen here.
  const remote = useRemote()
  const [screenView, setScreenView] = useState(false)
  const [queueOpen, setQueueOpen] = useState(false)
  const act: Call = useCallback(
    async (action, payload = {}, done) => {
      if (!rehearsing) return call(action, payload, done)
      const id = String(payload.activity_id ?? '')
      const a = Object.values(rehearsalActs ?? {}).find(x => x.id === id)
      const seg = a?.segmentId
      const t = now()
      // As the server does: opening starts the slide's countdown, +30s moves it on, closing stops it.
      if (a && seg && action === 'open_activity') setRehearsed(r => ({ ...r, [seg]: { status: 'open', openedAt: new Date(t).toISOString(), closesAt: closesAtFor(t, durationFor(a.kind, agenda.find(s => s.id === seg))) } }))
      if (seg && action === 'extend_activity') setRehearsed(r => (r[seg]?.status === 'open' ? { ...r, [seg]: { ...r[seg], closesAt: extendClosesAt(r[seg].closesAt, t) } } : r))
      if (seg && action === 'close_activity') setRehearsed(r => ({ ...r, [seg]: { status: 'closed', openedAt: r[seg]?.openedAt ?? new Date(t).toISOString(), closesAt: r[seg]?.closesAt ?? null } }))
      // The extras, as the server would: one question up at a time, answering takes it down, hidden words per cloud.
      if (action === 'show_question') setSampleShown(typeof payload.question_id === 'string' ? payload.question_id : null)
      if (action === 'answer_question') {
        const qid = String(payload.question_id ?? '')
        const done = payload.answered !== false
        setSampleQs(qs => qs.map(q => (q.id === qid ? { ...q, answered: done } : q)))
        if (done) setSampleShown(s => (s === qid ? null : s))
      }
      if (action === 'hide_word' || action === 'unhide_word') {
        setSampleHidden(h => ({ ...h, [id]: action === 'hide_word' ? hideWord(h[id], payload.word) : unhideWord(h[id], payload.word) }))
      }
      return null
    },
    [rehearsing, rehearsalActs, call, now, agenda],
  ) as Call

  const segmentId = local ? localPos?.segment : meeting.currentSegment
  const idx = Math.max(0, agenda.findIndex(s => s.id === segmentId))
  const seg: Segment | undefined = agenda[idx]
  // The activity this slide is about: an activity slide's own, a results slide's `of`.
  const key = seg ? activityKeyFor(agenda, seg.id) : null
  const sample = rehearsalActs && key && rehearsalActs[key] ? rehearseActivity(rehearsalActs[key], rehearsed[key], t, REHEARSE_ROOM) : null
  const activity = !live || !seg ? null : rehearsing ? (sample ? hiddenOut(withAnswer(sample, mine[sample.id], rehearsalActs?.[key!]?.config), sampleHidden) : null) : segmentActivity(state, seg)
  const participants = rehearsing ? REHEARSE_ROOM : state.room?.participants ?? 0
  const boss = activity ? bossPhase(activity, t) : null
  const presenting = rehearsing || (live && (local || meeting.presenterId === state.me))
  // The extras (migration 051): the question queue, the one on screen, the reactions. Rehearsal: its samples.
  const extrasReady = rehearsing || (live && state.room?.extrasReady !== false && !!state.room)
  const questions = useMemo(() => (rehearsing ? sortQueue(sampleQs) : state.room?.questions ?? []), [rehearsing, sampleQs, state.room?.questions])
  const shownQuestion = rehearsing ? sampleQs.find(q => q.id === sampleShown) ?? null : state.room?.shownQuestion ?? null
  const reactions = rehearsing ? sampleReactions : state.room?.reactions
  const waiting = openCount(questions)
  const last = idx === agenda.length - 1
  // An open activity holds its slide until it's closed (the server refuses too): only Close voting's move to its results goes.
  const resultsId = seg && activity ? resultsAfter(agenda, seg.id) : null
  const locked = !!seg && !!activity && activity.status === 'open' && activity.segmentId === seg.id && slideKind(seg, true) === 'activity'

  const go = useCallback(
    (to: number) => {
      if (!presenting || to < 0 || to >= agenda.length || to === idx) return
      if (locked && agenda[to].id !== resultsId) return
      const at = new Date(now()).toISOString()
      const segment = agenda[to].id
      if (local) {
        const pos = { segment, at }
        setLocalPos(pos)
        try { localStorage.setItem(posKey, JSON.stringify(pos)) } catch {}
        // As the API does on goto: what was open closes, an activity slide opens its own (lib/meet/slides.ts).
        if (rehearsing) {
          setRehearsed(r => {
            const refs = Object.values(rehearsalActs ?? {}).map(a => ({ id: a.segmentId, segment_id: a.segmentId, status: r[a.segmentId]?.status ?? 'ready' }))
            const plan = gotoPlan(agenda, segment, refs)
            const next = { ...r }
            for (const k of plan.close) next[k] = { status: 'closed', openedAt: r[k]?.openedAt ?? at, closesAt: r[k]?.closesAt ?? null }
            const kindOf = plan.open ? rehearsalActs?.[plan.open]?.kind : undefined
            if (plan.open && kindOf) next[plan.open] = { status: 'open', openedAt: at, closesAt: closesAtFor(new Date(at).getTime(), durationFor(kindOf, agenda.find(s => s.id === plan.open))) }
            return next
          })
        }
        return
      }
      optimistic({ currentSegment: segment, segmentStartedAt: at })
      call('goto', { segment })
    },
    [presenting, agenda, idx, locked, resultsId, now, local, posKey, rehearsing, rehearsalActs, optimistic, call],
  )

  // The countdown ran out and the server closed it: on to its results, as "Close voting" would.
  // Only on the presenting screen, only for a close that came from the clock (Close voting moves on itself).
  const seen = useRef<{ id: string; status: PublicActivity['status'] } | null>(null)
  useEffect(() => {
    const was = seen.current
    seen.current = activity && seg && activity.segmentId === seg.id ? { id: activity.id, status: activity.status } : null
    if (!presenting || !activity || !seg || was?.id !== activity.id || was.status !== 'open' || activity.status !== 'closed') return
    if (!resultsId || !expired(activity.closesAt, now())) return
    const to = agenda.findIndex(s => s.id === resultsId)
    // Not cancelled by the next render: this transition is seen once.
    setTimeout(() => go(to), 0)
  }, [activity, seg, presenting, resultsId, agenda, go, now])

  const start = async () => {
    const warning = earlyStartWarning(state.cycle.meeting_at, now())
    if (warning && !window.confirm(warning)) return
    if (rehearsalLeft(meeting) && !window.confirm('A rehearsal is still on. Starting the meeting ends it and deletes its answers.')) return
    const data = await call('start')
    if (data && local && agenda[0]) {
      const pos = { segment: agenda[0].id, at: new Date(now()).toISOString() }
      setLocalPos(pos)
      try { localStorage.setItem(posKey, JSON.stringify(pos)) } catch {}
    }
  }
  const endRehearsal = () => {
    if (!window.confirm('End the rehearsal? Every answer is deleted and the link stops working.')) return
    call('rehearse_end', {}, 'Rehearsal ended. Its answers are deleted.')
  }
  const end = dress ? endRehearsal : () => call('end', {}, 'Meeting ended: the recap is on the Run tab')
  const rehearseLive = () => call('rehearse_start', {}, 'Rehearsal on. Share the link.')
  const leave = useCallback(() => {
    router.push('/admin/run/meeting')
  }, [router])

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
      if (editing || e.metaKey || e.ctrlKey || e.altKey) return
      if ((e.target as HTMLElement)?.closest?.('input, textarea, select, [contenteditable]')) return
      if (e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); go(idx + 1) }
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); go(idx - 1) }
      else if (e.key === 'Escape' && !document.fullscreenElement) leave()
      else if (e.key === 'f' || e.key === 'F') fullscreen()
      else if (e.key === 'p' || e.key === 'P') toggleNotes()
      else if ((e.key === 'm' || e.key === 'M') && rehearsing) setPhone(on => !on)
      else if ((e.key === 'e' || e.key === 'E') && rehearsing) setEditing(true)
      else if ((e.key === 'q' || e.key === 'Q') && presenting) setQueueOpen(on => !on)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go, idx, leave, fullscreen, toggleNotes, rehearsing, editing, presenting])

  // Back from the editor: the preview runs on what was saved, on the slide that was being edited.
  const doneEditing = useCallback(
    (next: Segment[], slideId: string | null) => {
      optimistic({ agenda: next })
      if (slideId) {
        const pos = { segment: slideId, at: new Date(now()).toISOString() }
        setLocalPos(pos)
        try { localStorage.setItem(posKey, JSON.stringify(pos)) } catch {}
      }
      setEditing(false)
    },
    [optimistic, now, posKey],
  )
  const savedEdit = useCallback((next: Segment[]) => optimistic({ agenda: next }), [optimistic])

  if (editing && rehearsal) {
    return (
      <SlideEditor
        cycleId={state.cycle.id}
        label={state.cycle.label}
        meeting={meeting}
        stored={rehearsal}
        posts={allPosts}
        board={board ?? []}
        serverNow={serverNow}
        now={now}
        onDone={doneEditing}
        onSaved={savedEdit}
        initialSlide={segmentId ?? null}
      />
    )
  }

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

  const kind = slideKind(seg, !!activity)
  const sections = sectionsOf(agenda)
  const section = sections.find(x => idx >= x.start && idx < x.start + x.slides) ?? null
  const cue = seg.cue?.trim() || null
  // The presenter's notes: rehearsal only. The live screen is shared.
  const prep = rehearsing && notes && !ended ? seg.prep : null
  const sidePad = rehearsing && phone ? 'pr-[420px]' : ''
  const resultsIdx = resultsId ? agenda.findIndex(x => x.id === resultsId) : -1
  // "Close voting": on to the results slide (moving there closes it), else close in place.
  const closeActivity = () => {
    if (resultsIdx >= 0) go(resultsIdx)
    else if (activity) act('close_activity', { activity_id: activity.id })
  }

  // Tap a cloud word to hide it (the presenter only; the server needs migration 051, said in the header).
  const hiddenNow = !activity || activity.kind !== 'cloud' ? null : rehearsing ? sampleHidden[activity.id] ?? [] : state.hidden?.activityId === activity.id ? state.hidden.words : null
  const moderation: Moderation | null =
    presenting && activity && hiddenNow
      ? {
          hidden: hiddenNow,
          hide: word => act('hide_word', { activity_id: activity.id, word }),
          unhide: word => act('unhide_word', { activity_id: activity.id, word }),
          busy: !rehearsing && (busy === 'hide_word' || busy === 'unhide_word'),
        }
      : null
  const showQuestion = (id: string | null) => act('show_question', { question_id: id })
  const answerQuestion = (id: string, answered: boolean) => act('answer_question', { question_id: id, answered })

  // On a phone the presenter gets the clicker (lib/meet/clicker.ts); "Screen view" shows the slides instead.
  if (remote && !screenView && presenting && live && !ended && !local && !rehearsing) {
    return (
      <PresenterRemote
        label={state.cycle.label}
        agenda={agenda}
        idx={idx}
        activity={activity}
        participants={participants}
        busy={busy}
        now={now}
        refresh={refresh}
        go={go}
        call={act}
        onClose={closeActivity}
        rehearsal={dress}
        questions={questions}
        shownId={shownQuestion?.id ?? null}
        extrasReady={extrasReady}
        onShow={showQuestion}
        onAnswer={answerQuestion}
        onScreenView={() => setScreenView(true)}
      />
    )
  }

  let stage: React.ReactNode
  if (ended) {
    stage = (
      <div className="my-auto">
        <h1 className="text-[clamp(40px,2.9vw,56px)] font-semibold leading-[1.08] tracking-[-0.03em] text-ink">That’s the meeting.</h1>
        <Link href="/admin/run#run-recap" className="mt-8 inline-block text-[17px] text-ink underline underline-offset-4">Write the recap</Link>
        <ReportButton cycleId={state.cycle.id} label={state.cycle.label} className="mt-8" />
      </div>
    )
  } else if (!live) {
    stage = (
      <TitleStage eyebrow={`${state.cycle.label} guild meeting`} title={seg.title || 'Ready when you are'} cue={cue} kers={false}>
        <div className="mt-10 flex items-center gap-3">
          <Button icon={Play} disabled={!!busy} onClick={start}>{busy === 'start' ? 'Starting…' : 'Start meeting mode'}</Button>
          {meeting.rehearsalReady === false ? (
            <span className="inline-flex h-8 items-center px-1 text-footnote text-ink-muted">Rehearse live: apply migration 047</span>
          ) : (
            <Button variant="secondary" disabled={!!busy} onClick={rehearseLive}>{busy === 'rehearse_start' ? 'Starting…' : 'Rehearse live (with phones)'}</Button>
          )}
          <Link href="/meet/present?rehearse=1" className="press inline-flex h-8 items-center rounded-full bg-kinu/70 px-3 text-footnote font-medium text-ink-soft hover:bg-kinu hover:text-ink">Preview alone</Link>
          <p className="ml-3 text-footnote text-ink-muted">The room opens on everyone’s phone when you start.</p>
        </div>
      </TitleStage>
    )
  } else {
    stage = (
      <SlideBody
        seg={seg}
        kind={kind}
        activity={activity}
        posts={posts}
        section={section?.title}
        first={idx === 0}
        last={last}
        participants={participants}
        joinPath={idx === 0 && kind === 'title' && !rehearsing ? (dress && meeting.rehearsalCode ? rehearsalPath(meeting.rehearsalCode) : '/meet') : null}
        hero={{ presenting, now, call: act, busy: rehearsing ? null : busy, onClose: closeActivity, onResults: resultsIdx >= 0 ? () => go(resultsIdx) : null, onExpire: rehearsing ? undefined : refresh, moderation }}
      />
    )
  }

  return (
    <Shell>
      {/* ─── Header: the board's chrome, quiet ─── */}
      <header className="flex h-16 shrink-0 items-center gap-4 px-10">
        <Wordmark />
        <span aria-hidden className="h-5 w-px bg-border-strong" />
        <p className="eyebrow">{state.cycle.label} guild meeting</p>
        {rehearsing && <span className="inline-flex h-7 items-center rounded-full bg-fill px-3 text-footnote text-ink-soft">Rehearsal · nothing is live</span>}
        {dress && <span className="inline-flex h-7 items-center rounded-full bg-fill px-3 text-footnote font-medium text-ink">Rehearsal</span>}
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
            {live && !rehearsing && presenting && state.room?.timerReady === false && <span className="mr-1.5 text-footnote text-ink-muted">No countdown: apply migration 048</span>}
            {live && !rehearsing && presenting && state.room?.extrasReady === false && <span className="mr-1.5 text-footnote text-ink-muted">Reactions, questions, hiding words: apply migration 051</span>}
            {live && presenting && !ended && extrasReady && (
              <Button variant="ghost" onClick={() => setQueueOpen(on => !on)} aria-pressed={queueOpen} title="Q">
                Questions{waiting ? <span className="tabular"> ({waiting})</span> : null}
              </Button>
            )}
            {rehearsing && (
              <Button variant="ghost" icon={PencilSimple} onClick={() => setEditing(true)} title="E">Edit slides</Button>
            )}
            {rehearsing && (
              <Button variant="ghost" onClick={() => setPhone(on => !on)} aria-pressed={phone} title="M">{phone ? 'Hide phone' : 'Phone preview'}</Button>
            )}
            {rehearsing && seg.prep?.points.length ? (
              <Button variant="ghost" onClick={toggleNotes} aria-pressed={notes} title="P">{notes ? 'Hide notes' : 'Notes'}</Button>
            ) : null}
            {presenting && !rehearsing && !last && <Button variant="ghost" icon={Stop} disabled={!!busy} onClick={end}>{dress ? 'End rehearsal' : 'End'}</Button>}
            <Button variant="ghost" icon={isFull ? ArrowsIn : ArrowsOut} onClick={fullscreen} aria-label={isFull ? 'Leave full screen' : 'Full screen'} />
            <Link href="/admin/run/meeting" className="press inline-flex h-8 items-center rounded-full px-3 text-footnote text-ink-muted hover:bg-kinu/60 hover:text-ink">
              Esc
            </Link>
          </div>
        </div>
      </header>

      {dress && meeting.rehearsalCode && <RehearsalBar code={meeting.rehearsalCode} />}

      {/* ─── Stage: one slide ─── */}
      <main aria-live="polite" className={cn('mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col px-14 pb-4 pt-6', sidePad)}>
        {stage}

        {prep && (prep.opener || prep.points.length > 0) && (
          <aside aria-label="Your notes (rehearsal only)" className="mt-4 max-w-[72rem] shrink-0 rounded-(--radius-card) border border-dashed border-border-strong px-5 py-3">
            <p className="eyebrow">Your notes · only you see these (your phone, live)</p>
            {prep.opener && <p className="mt-1.5 text-[15px] leading-relaxed text-ink-soft"><span className="font-medium text-ink">Say: </span>{prep.opener}</p>}
            <ul className="mt-1 space-y-0.5">
              {prep.points.map((pt, i) => (
                <li key={i} className="flex gap-3 text-[14px] leading-relaxed text-ink-muted">
                  <span aria-hidden className="mt-[0.7em] size-1 shrink-0 rounded-full bg-ink-muted/70" />
                  {pt}
                </li>
              ))}
            </ul>
          </aside>
        )}
      </main>

      {/* The question pulled onto the slide: everyone watching the screen sees it; the presenter can take it down. */}
      {live && !ended && shownQuestion && (
        <div className={cn('pointer-events-none fixed inset-x-0 bottom-24 z-10 flex justify-center px-14', sidePad)}>
          <QuestionOverlay className="pointer-events-auto w-full" question={shownQuestion} onDismiss={presenting ? () => showQuestion(null) : undefined} />
        </div>
      )}

      {/* The presenter's queue (Q). */}
      {live && !ended && presenting && queueOpen && (
        <QuestionQueue
          className={cn('fixed bottom-24 top-20 z-20 w-[340px] shadow-[0_16px_40px_var(--shadow-tint-strong)]', rehearsing && phone ? 'right-[420px]' : 'right-6')}
          questions={questions}
          shownId={shownQuestion?.id ?? null}
          ready={extrasReady}
          busy={!rehearsing && !!busy}
          onShow={showQuestion}
          onAnswer={answerQuestion}
          onClose={() => setQueueOpen(false)}
        />
      )}

      {/* Reactions from the phones float up from the corner (a quiet count under reduced motion). */}
      {live && !ended && <ReactionFloats totals={reactions} className={cn('fixed bottom-24 z-10', rehearsing && phone ? 'right-[440px]' : 'right-10')} />}

      {/* Rehearsal only: the phone side, to tap through. Never on the live screen. */}
      {rehearsing && phone && (
        <PhonePreview
          cycleId={meeting.cycleId}
          label={state.cycle.label}
          segment={seg.id}
          activity={activity}
          agenda={publicSegments(agenda)}
          posts={posts}
          notes={presenterNotes(agenda, 'rehearsal', 'rehearsal')}
          participants={participants}
          mine={mine}
          onAnswer={onAnswer}
          extras={{ questions, shownQuestion, voted: sampleVoted, ask: previewAsk, vote: previewVote, react: previewReact }}
        />
      )}

      {/* ─── The line, the arrows, Kers ─── */}
      <footer className="flex h-20 shrink-0 items-center gap-5 pl-10 pr-6">
        {presenting && <NavArrow label="Back" icon={CaretLeft} disabled={idx === 0 || locked} onClick={() => go(idx - 1)} />}
        <AgendaProgress agenda={agenda} index={idx} onPick={presenting && !locked ? go : undefined} className="min-w-0 flex-1" />
        {presenting && (last ? (
          rehearsing ? (
            <Button variant="secondary" onClick={leave}>Done rehearsing</Button>
          ) : (
            <Button variant="secondary" icon={Stop} disabled={!!busy} onClick={end}>{dress ? 'End rehearsal' : 'End meeting'}</Button>
          )
        ) : (
          <NavArrow label="Next" icon={CaretRight} disabled={locked} onClick={() => go(idx + 1)} />
        ))}
        <PresenterKers className={cn('-mb-2 ml-3 shrink-0', kind === 'title' && live && !ended && 'invisible')} segmentKey={section ? String(section.start) : seg.id} live={live} ended={ended} boss={boss} />
      </footer>
    </Shell>
  )
}

/**
 * The live rehearsal's strip under the header: it's a rehearsal, answers go
 * afterwards, and how to join: a QR (the first slide shows it big; here it
 * opens on demand so it never covers a slide) and Copy link.
 */
function RehearsalBar({ code }: { code: string }) {
  const toast = useToast()
  const origin = useOrigin()
  const [qr, setQr] = useState(false)
  const link = `${origin}${rehearsalPath(code)}`
  const copy = () => {
    navigator.clipboard?.writeText(link).then(() => toast('Link copied', 'success'), () => toast('Copy it by hand', 'error'))
  }
  return (
    <div className="relative mx-10 flex h-10 shrink-0 items-center gap-3 rounded-full bg-fill/70 pl-4 pr-1.5 text-footnote text-ink-soft">
      <span className="shrink-0">Rehearsal · answers are deleted afterwards</span>
      <div className="ml-auto flex shrink-0 items-center gap-1">
        <Button variant="ghost" icon={QrCode} onClick={() => setQr(on => !on)} aria-pressed={qr}>{qr ? 'Hide QR' : 'QR to join'}</Button>
        <Button variant="ghost" icon={Copy} onClick={copy}>Copy link</Button>
      </div>
      {qr && (
        <div className="absolute right-0 top-12 z-10 rounded-(--radius-card) border border-border bg-parchment p-5 shadow-lg">
          <JoinQr path={rehearsalPath(code)} size={240} caption="Scan to join the rehearsal" />
        </div>
      )}
    </div>
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
