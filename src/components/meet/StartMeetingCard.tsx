'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowCounterClockwise, Play } from '@phosphor-icons/react/dist/ssr'
import { Kers } from '@/components/kers/Kers'
import { Icon } from '@/components/ui/Icon'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'
import { canReopen, defaultStartMode, earlyStartWarning, MEET_REHEARSE_MS, MEET_TAIL_MS, meetingDone, meetingLive, type MeetingState } from '@/lib/meeting'
import { rehearsalLeft, rehearsalOn } from '@/lib/meet/liveRehearsal'

type Mode = 'live' | 'rehearse'

function until(ms: number): string {
  if (ms <= 0) return 'now'
  const m = Math.round(ms / 60_000)
  return m >= 60 ? `in ${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `in ${m} min`
}

async function send(action: string, cycleId: string): Promise<MeetingState> {
  const res = await fetch('/api/admin/meeting', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, cycle_id: cycleId }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Could not do that')
  return data
}

/**
 * The meeting card at the top of the board for admins, from the day before
 * the meeting (MEET_REHEARSE_MS) until it ends (docs/08-meeting-mode-v2.md).
 * Two actions: "Preview slides" opens the presenter screen in solo
 * rehearsal (/meet/present?rehearse=1: the real agenda and prep, sample
 * answers, nothing written, nothing live), and "Start" opens a small sheet:
 *
 *   Rehearse  a live rehearsal: real phones, a private link, answers wiped
 *             afterwards (lib/meet/liveRehearsal.ts)
 *   Go live   meeting mode on: everyone sees the banner, this admin presents
 *
 * Go live is picked inside the 30 minutes before the meeting, Rehearse
 * before that (defaultStartMode). Nothing runs until Start in the sheet,
 * which also carries the early-start and rehearsal-on warnings.
 *
 * Once it's live it says who presents and opens the screen (read-only for
 * others). For an hour after End it offers "Reopen meeting" (answers kept).
 * An accidental Start then End with nobody in undoes itself on the server.
 *
 * Loading it also asks the server to draft any of Kers' prep still missing
 * (?prep=1): the "3 h before at the latest" trigger.
 */
export function StartMeetingCard() {
  const { isAdmin } = useAuth()
  const router = useRouter()
  const toast = useToast()
  const [s, setS] = useState<MeetingState | null>(null)
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState<number | null>(null)
  const [sheet, setSheet] = useState<Mode | null>(null)

  useEffect(() => {
    if (!isAdmin) return
    let alive = true
    fetch('/api/admin/meeting?prep=1', { cache: 'no-store' })
      .then(r => (r.ok ? r.json() : null))
      .then(d => { if (alive && d?.cycle) { setS(d); setNow(Date.now()) } })
      .catch(() => {})
    const t = setInterval(() => setNow(Date.now()), 30_000)
    return () => { alive = false; clearInterval(t) }
  }, [isAdmin])

  if (!isAdmin || !s || now === null) return null

  const go = async (mode: Mode) => {
    if (mode === 'rehearse' && s.meeting.rehearsalReady === false) {
      toast('Rehearsing needs migration 047 applied in Supabase first.', 'error')
      return
    }
    setBusy(true)
    try {
      await send(mode === 'live' ? 'start' : 'rehearse_start', s.cycle.id)
      router.push('/meet/present')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not start it', 'error')
      setBusy(false)
    }
  }

  const reopen = async () => {
    setBusy(true)
    try {
      setS(await send('reopen', s.cycle.id))
      router.push('/meet/present')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not reopen it', 'error')
      setBusy(false)
    }
  }

  // A rehearsal already on: Start means the real thing.
  const openSheet = () => {
    const t = Date.now()
    setNow(t)
    setSheet(rehearsalOn(s.meeting, t) ? 'live' : defaultStartMode(s.cycle.meeting_at, t))
  }

  return (
    <>
      <StartMeetingCardView s={s} now={now} busy={busy} onStart={openSheet} onReopen={reopen} />
      {sheet && <StartSheet s={s} now={now} initial={sheet} busy={busy} onClose={() => setSheet(null)} onGo={go} />}
    </>
  )
}

/**
 * Start's sheet: Rehearse or Go live, one picked by the time, and nothing
 * happens until its Start button. Going live early or over a running
 * rehearsal says so first, here.
 */
function StartSheet({ s, now, initial, busy, onClose, onGo }: { s: MeetingState; now: number; initial: Mode; busy: boolean; onClose: () => void; onGo: (mode: Mode) => void }) {
  const [mode, setMode] = useState<Mode>(initial)
  const noRehearsal = s.meeting.rehearsalReady === false
  const rehearsing = rehearsalOn(s.meeting, now)
  const early = earlyStartWarning(s.cycle.meeting_at, now)
  const leftover = rehearsalLeft(s.meeting) ? 'A rehearsal is still on. Going live ends it and deletes its answers.' : null
  const warning = mode === 'live' ? [early, leftover].filter(Boolean).join(' ') || null : null
  const options: { value: Mode; title: string; text: string; disabled?: boolean }[] = [
    {
      value: 'rehearse',
      title: rehearsing ? 'Rejoin the rehearsal' : 'Rehearse',
      text: noRehearsal ? 'Needs migration 047 applied in Supabase.' : 'A private link for real phones. No banner, and every answer is deleted afterwards.',
      disabled: noRehearsal,
    },
    { value: 'live', title: 'Go live', text: 'The meeting starts for real: everyone sees the live banner, and you present.' },
  ]
  return (
    <Modal title="Start the meeting" subtitle={`${s.cycle.label} guild meeting`} onClose={onClose} className="max-w-md">
      <div className="space-y-4 p-5">
        <div role="radiogroup" aria-label="How to start" className="space-y-2">
          {options.map(o => {
            const on = mode === o.value
            return (
              <label
                key={o.value}
                className={cn(
                  'flex cursor-pointer gap-3 rounded-(--radius-control) border px-3.5 py-3 transition-colors duration-150',
                  on ? 'border-ink/60 bg-paper' : 'border-border hover:border-border-strong',
                  o.disabled && 'cursor-not-allowed opacity-55',
                )}
              >
                <input
                  type="radio"
                  name="start-mode"
                  value={o.value}
                  checked={on}
                  disabled={o.disabled}
                  onChange={() => setMode(o.value)}
                  className="mt-0.5 size-4 shrink-0 accent-ink"
                />
                <span className="min-w-0">
                  <span className="block text-footnote font-medium text-ink">{o.title}</span>
                  <span className="block text-caption leading-relaxed text-ink-muted">{o.text}</span>
                </span>
              </label>
            )
          })}
        </div>
        {warning && <p role="status" className="text-footnote leading-relaxed text-vermillion">{warning}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>Not yet</Button>
          <Button icon={Play} disabled={busy || (mode === 'rehearse' && noRehearsal)} onClick={() => onGo(mode)}>
            {busy ? 'Starting…' : mode === 'live' ? 'Start, go live' : 'Start rehearsing'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}

/** The card from the meeting's state. */
export function StartMeetingCardView({ s, now, busy, onStart, onReopen }: { s: MeetingState; now: number; busy: boolean; onStart: () => void; onReopen?: () => void }) {
  if (!s.cycle.meeting_at) return null
  const { meeting } = s
  const at = new Date(s.cycle.meeting_at).getTime()
  const live = meetingLive(meeting, now)
  const reopenable = !live && canReopen(meeting, now)
  const done = meetingDone(meeting, s.cycle.meeting_at)
  if (done && !reopenable) return null
  if (!live && !reopenable && (now < at - MEET_REHEARSE_MS || now > at + MEET_TAIL_MS)) return null

  const time = new Date(at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' })
  // Memes carry no notes: count the slides that should.
  const notable = meeting.agenda.filter(x => x.slide !== 'meme')
  const prepped = notable.filter(x => x.prep && (x.prep.points.length || x.prep.opener)).length

  const button = 'press inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-ink px-3.5 text-footnote font-medium text-parchment hover:bg-ink/85 disabled:opacity-40 pointer-coarse:h-10'
  const quiet = 'press inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-kinu/70 px-3.5 text-footnote font-medium text-ink-soft hover:bg-kinu hover:text-ink pointer-coarse:h-10'
  const preview = <Link href="/meet/present?rehearse=1" className={quiet} title="Step through the slides alone, with sample answers">Preview slides</Link>

  let title: string
  let body: string
  let action: React.ReactNode
  if (reopenable) {
    const ended = new Date(meeting.endedAt!).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' })
    title = `The meeting ended at ${ended}`
    body = 'Ended too soon? Reopen it within the hour: every answer is kept.'
    action = (
      <div className="flex shrink-0 flex-wrap gap-1.5">
        {/* A test run hours early doesn't count as the meeting: Start stays too. */}
        {done ? <Link href="/admin/run#run-recap" className={quiet}>Write the recap</Link> : (
          <button type="button" className={quiet} disabled={busy} onClick={onStart} aria-haspopup="dialog">Start again</button>
        )}
        {onReopen && (
          <button type="button" className={button} disabled={busy} onClick={onReopen}>
            <Icon icon={ArrowCounterClockwise} size="sm" weight="bold" /> {busy ? 'Reopening…' : 'Reopen meeting'}
          </button>
        )}
      </div>
    )
  } else if (!live && rehearsalOn(meeting, now)) {
    title = 'A rehearsal is on'
    body = meeting.presenterId === s.me ? 'You’re rehearsing. The link and End rehearsal are on the presenter screen.' : s.presenterName ? `@${s.presenterName} is rehearsing.` : 'Nobody is presenting it.'
    action = (
      <div className="flex shrink-0 flex-wrap gap-1.5">
        <Link href="/meet/present" className={quiet}>Open the presenter screen</Link>
        <button type="button" className={button} disabled={busy} onClick={onStart}>
          <Icon icon={Play} size="sm" weight="fill" /> Start
        </button>
      </div>
    )
  } else if (live) {
    title = 'Meeting mode is on'
    body = meeting.presenterId === s.me ? 'You’re presenting.' : s.presenterName ? `@${s.presenterName} is presenting. You can follow along or take over.` : 'Nobody is presenting yet.'
    action = <Link href="/meet/present" className={button}>Open the presenter screen</Link>
  } else if (!meeting.agenda.length) {
    title = `The meeting is ${until(at - now)}`
    body = 'There’s no agenda saved yet, so there’s nothing to present.'
    action = <Link href="/admin/run" className={button}>Build the agenda</Link>
  } else {
    title = `Guild meeting ${until(at - now)} · ${time}`
    body = prepped
      ? `Notes ready for ${prepped} of ${notable.length} ${meeting.agenda.some(x => x.slide) ? 'slides' : 'segments'}.`
      : 'Kers is still on his prep. Preview the slides before you start.'
    action = (
      <div className="flex shrink-0 flex-wrap gap-1.5">
        {preview}
        <button type="button" className={button} disabled={busy} onClick={onStart} aria-haspopup="dialog">
          <Icon icon={Play} size="sm" weight="fill" /> {busy ? 'Starting…' : 'Start'}
        </button>
      </div>
    )
  }

  return (
    <section
      aria-label="Meeting mode"
      className="flex flex-wrap items-center gap-x-3 gap-y-2.5 rounded-(--radius-card) border border-saffron/25 bg-paper px-3.5 py-3 shadow-[0_0_24px_-10px] shadow-saffron/35"
    >
      <div className="flex min-w-[220px] flex-1 basis-[260px] items-center gap-3">
        <Kers size={32} expression={reopenable ? 'nosy' : 'excited'} colour="meeting" />
        <div className="min-w-0">
          <p className="truncate text-footnote font-medium text-ink">{title}</p>
          <p className="text-caption text-ink-muted text-pretty">{body}</p>
        </div>
      </div>
      {action}
    </section>
  )
}
