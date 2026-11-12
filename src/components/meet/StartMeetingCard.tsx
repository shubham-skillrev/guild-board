'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Play } from '@phosphor-icons/react/dist/ssr'
import { Kers } from '@/components/kers/Kers'
import { Icon } from '@/components/ui/Icon'
import { useAuth } from '@/hooks/useAuth'
import { useToast } from '@/hooks/useToast'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { earlyStartWarning, MEET_REHEARSE_MS, MEET_TAIL_MS, meetingLive, type MeetingState } from '@/lib/meeting'

function until(ms: number): string {
  if (ms <= 0) return 'now'
  const m = Math.round(ms / 60_000)
  return m >= 60 ? `in ${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m` : `in ${m} min`
}

/**
 * The meeting card at the top of the board for admins, from the day before
 * the meeting (MEET_REHEARSE_MS) until it ends. Two actions: "Rehearse"
 * opens the presenter screen in rehearsal (/meet/present?rehearse=1: the
 * real agenda and prep, sample answers, nothing written, nothing live), and
 * "Start meeting" marks it live and makes this admin the presenter, then
 * opens /meet/present. More than 3 h early, Start asks first: going live a
 * day early by accident is the risk. Once it's live it says who presents and
 * opens the screen (read-only for others).
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
  const [asking, setAsking] = useState<string | null>(null)

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

  const start = async (confirmed = false) => {
    const warning = earlyStartWarning(s.cycle.meeting_at, Date.now())
    if (warning && !confirmed) {
      setAsking(warning)
      return
    }
    setAsking(null)
    setBusy(true)
    try {
      const res = await fetch('/api/admin/meeting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', cycle_id: s.cycle.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not start it')
      router.push('/meet/present')
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not start it', 'error')
      setBusy(false)
    }
  }

  return (
    <>
      <StartMeetingCardView s={s} now={now} busy={busy} onStart={() => start()} />
      {asking && (
        <Modal title="Start the meeting now?" onClose={() => setAsking(null)} className="max-w-md">
          <div className="space-y-4 p-5">
            <p className="text-footnote leading-relaxed text-ink-soft">{asking}</p>
            <p className="text-footnote leading-relaxed text-ink-muted">To practise, use Rehearse instead: it shows the real agenda and changes nothing.</p>
            <div className="flex justify-end gap-2">
              <Button variant="secondary" onClick={() => setAsking(null)}>Not yet</Button>
              <Button variant="danger" onClick={() => start(true)}>Start it now</Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}

/** The card from the meeting's state (the dev mock, /meet/mock, renders it with fake state). */
export function StartMeetingCardView({ s, now, busy, onStart }: { s: MeetingState; now: number; busy: boolean; onStart: () => void }) {
  if (!s.cycle.meeting_at) return null
  const { meeting } = s
  const at = new Date(s.cycle.meeting_at).getTime()
  const live = meetingLive(meeting, now)
  if (meeting.endedAt) return null
  if (!live && (now < at - MEET_REHEARSE_MS || now > at + MEET_TAIL_MS)) return null

  const time = new Date(at).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: 'numeric', minute: '2-digit' })
  const prepped = meeting.agenda.filter(x => x.prep && (x.prep.points.length || x.prep.opener)).length

  const button = 'press inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-ink px-3.5 text-footnote font-medium text-parchment hover:bg-ink/85 disabled:opacity-40 pointer-coarse:h-10'
  const quiet = 'press inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-kinu/70 px-3.5 text-footnote font-medium text-ink-soft hover:bg-kinu hover:text-ink pointer-coarse:h-10'

  let title: string
  let body: string
  let action: React.ReactNode
  if (live) {
    title = 'Meeting mode is on'
    body = meeting.presenterId === s.me ? 'You’re presenting.' : s.presenterName ? `@${s.presenterName} is presenting. You can follow along or take over.` : 'Nobody is presenting yet.'
    action = <Link href="/meet/present" className={button}>Open the presenter screen</Link>
  } else if (!meeting.agenda.length) {
    title = `The meeting is ${until(at - now)}`
    body = 'There’s no agenda saved yet, so there’s nothing to present.'
    action = <Link href="/admin/run" className={button}>Build the agenda</Link>
  } else {
    title = `The meeting is ${until(at - now)}, at ${time}`
    body = prepped
      ? `Kers has prep for ${prepped} of ${meeting.agenda.length} segments. Rehearse it now; on the day, share your screen and start.`
      : 'Kers is still on his prep. Rehearse it now; on the day, share your screen and start.'
    action = (
      <div className="flex shrink-0 gap-2">
        <Link href="/meet/present?rehearse=1" className={quiet}>Rehearse</Link>
        <button type="button" className={button} disabled={busy} onClick={onStart}>
          <Icon icon={Play} size="sm" weight="fill" /> {busy ? 'Starting…' : 'Start meeting'}
        </button>
      </div>
    )
  }

  return (
    <section
      aria-label="Meeting mode"
      className="flex items-center gap-4 rounded-(--radius-card) border border-saffron/25 bg-paper p-4 shadow-[0_0_32px_-8px] shadow-saffron/35 max-sm:flex-wrap"
    >
      <Kers size={56} expression="excited" colour="meeting" />
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium text-ink">{title}</p>
        <p className="mt-0.5 text-footnote text-ink-muted">{body}</p>
      </div>
      {action}
    </section>
  )
}
