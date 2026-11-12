'use client'

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { PresenterView } from '@/components/meet/PresenterScreen'
import { MeetRoom, type MeetRoomOffline } from '@/components/meet/MeetRoom'
import { StartMeetingCardView } from '@/components/meet/StartMeetingCard'
import { MeetingLiveBannerView } from '@/components/layout/MeetingLiveBanner'
import { OVERLAY_PRIORITY, useOverlaySlot } from '@/components/ui/OverlaySlot'
import { cn } from '@/lib/utils/cn'
import { BLOCKED_MESSAGE, cleanWord, CLOUD_MAX_WORDS, type MeetView } from '@/lib/meet/activity'
import type { MeetingState } from '@/lib/meeting'
import { AGENDA, buildPhone, buildState, PHONE_STATES, POSTS, readKnobs, type Knobs } from './data'

const PHONE_W = 375
const PHONE_H = 740
const noop = () => {}
const subscribeNothing = () => noop

/**
 * The meeting-mode mock (/meet/mock, dev only): the real presenter screen,
 * phone room, banner and board card on fake state from the URL. Nothing is
 * fetched or written: the presenter's `call` and the phone's `post` answer
 * here. `frame=presenter|phone` is one screen alone (the iframes in "phone"
 * and "both" views); `hud=0` or the H key hides the toolbar.
 */
export function MeetMock() {
  // Everything here hangs off the browser's clock: render in the browser only.
  const client = useSyncExternalStore(subscribeNothing, () => true, () => false)
  return client ? <Mock /> : null
}

function Mock() {
  const q = useSearchParams()
  const router = useRouter()
  const path = usePathname()
  const k = useMemo(() => readKnobs(new URLSearchParams(q.toString())), [q])
  const frame = q.get('frame')
  // No install or push prompt over the mock (the presenter and a live room hold this slot too).
  useOverlaySlot('meet-mock', OVERLAY_PRIORITY.presenter, true)
  const [hud, setHud] = useState(q.get('hud') !== '0')

  const set = useCallback(
    (patch: Partial<Record<keyof Knobs, string | number | boolean>>) => {
      const next = new URLSearchParams(q.toString())
      for (const [key, v] of Object.entries(patch)) {
        if (v === false || v === '' || v === undefined) next.delete(key)
        else next.set(key, v === true ? '1' : String(v))
      }
      router.replace(`${path}?${next.toString()}`, { scroll: false })
    },
    [q, router, path],
  )

  useEffect(() => {
    document.documentElement.classList.toggle('dark', k.dark)
  }, [k.dark])

  useEffect(() => {
    if (frame) return
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      if ((e.target as HTMLElement)?.closest('input, textarea, select, [contenteditable]')) return
      if (e.key === 'h' || e.key === 'H') setHud(h => !h)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [frame])

  if (frame === 'presenter') return <MockPresenter k={k} set={set} />
  if (frame === 'phone') return <MockPhone k={k} />

  // The frames get the same knobs, minus the toolbar's own.
  const frameSrc = (which: string) => {
    const p = new URLSearchParams(q.toString())
    p.set('frame', which)
    p.delete('hud')
    return `${path}?${p.toString()}`
  }

  return (
    <>
      {k.view === 'presenter' && <MockPresenter k={k} set={set} />}
      {k.view === 'phone' && (
        <div className="fixed inset-0 flex items-center justify-center bg-kinu/60">
          <PhoneFrame src={frameSrc('phone')} />
        </div>
      )}
      {k.view === 'both' && <Both presenterSrc={frameSrc('presenter')} phoneSrc={frameSrc('phone')} />}
      {k.view === 'board' && <MockBoard k={k} />}
      {hud && <Toolbar k={k} set={set} />}
    </>
  )
}

/** The wall clock, once a second: drives the simulation and the pinned stamps. */
function useNow(): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  return now
}

/** When the knobs last changed: the fixed stamps (segment start, poll opened) hang off it, so clocks tick. */
function useT0(k: Knobs, now: number): number {
  const key = JSON.stringify({ ...k, view: null, phone: null, dark: null, sim: null })
  const [t0, setT0] = useState(() => ({ key, at: now }))
  if (t0.key !== key) setT0({ key, at: now })
  return t0.at
}

function MockPresenter({ k, set }: { k: Knobs; set: (p: Partial<Record<keyof Knobs, string | number | boolean>>) => void }) {
  const now = useNow()
  const t0 = useT0(k, now)
  const state: MeetingState = useMemo(() => buildState(k, t0, now), [k, t0, now])
  const clockNow = useCallback(() => Date.now(), [])

  // The presenter's writes, answered here: moving and opening change the knobs, the rest do nothing.
  const call = useCallback(
    async <T,>(action: string, payload: Record<string, unknown> = {}): Promise<T | null> => {
      if (action === 'goto') {
        const i = AGENDA.findIndex(s => s.id === payload.segment)
        if (i >= 0) set({ seg: i + 1, time: 'ontime', act: 'ready', boss: 'intro' })
      } else if (action === 'open_activity') set({ act: 'fresh' })
      else if (action === 'close_activity') set({ act: 'closed', boss: 'verdict' })
      else if (action === 'start' || action === 'take_over') set({ meet: 'live', pres: 'me' })
      else if (action === 'end') set({ meet: 'ended' })
      return null
    },
    [set],
  )

  return <PresenterView state={state} busy={null} call={call} optimistic={noop} now={clockNow} serverNow={state.serverNow} posts={POSTS} onExit={noop} />
}

function MockPhone({ k }: { k: Knobs }) {
  const now = useNow()
  const t0 = useT0(k, now)
  const setup = useMemo(() => buildPhone(k, t0, now), [k, t0, now])
  // The room re-made every second; the phone itself only re-mounts when its state changes.
  const mountKey = `${k.phone}:${k.seg}:${k.act}:${k.boss}:${k.meet}`
  const [init, setInit] = useState<{ key: string; view: MeetView }>(() => ({ key: mountKey, view: setup.view }))
  if (init.key !== mountKey) setInit({ key: mountKey, view: setup.view })
  const initial = init.key === mountKey ? init.view : setup.view

  const words = useRef<string[]>([])
  const offline: MeetRoomOffline = useMemo(
    () => ({
      room: setup.room,
      demo: setup.demo,
      // POST /api/meet, answered on the page.
      post: async (body: Record<string, unknown>) => {
        await new Promise(r => setTimeout(r, 250))
        const view = initial
        if (body.action === 'join') {
          const name = typeof body.name === 'string' ? body.name : null
          return { ...view, member: name ? null : view.member, joined: { kind: name ? 'guest' : 'member', name } }
        }
        const id = String(body.activity_id)
        const value = (body.value ?? {}) as Record<string, unknown>
        if ('word' in value) {
          // Stand-in for the server's filter: anything with a * or "badword" is refused.
          const w = cleanWord(value.word)
          if (!w) throw new Error('Type a word first.')
          if (/\*|badword/.test(String(value.word))) return { ok: true, blocked: true, message: BLOCKED_MESSAGE }
          const before = view.mine?.activityId === id ? view.mine.values.map(v => String(v.word)) : []
          if (!words.current.length) words.current = before
          if (!words.current.includes(w)) words.current = [...words.current, w].slice(0, CLOUD_MAX_WORDS)
          return { ok: true, mine: { activityId: id, values: words.current.map(word => ({ word })) } }
        }
        return { ok: true, mine: { activityId: id, values: [value] } }
      },
    }),
    [setup.room, setup.demo, initial],
  )

  return <MeetRoom key={mountKey} initial={initial} offline={offline} />
}

function PhoneFrame({ src }: { src: string }) {
  return (
    <div className="shrink-0 rounded-[44px] border border-border-strong bg-ink/90 p-2.5 shadow-xl">
      <iframe title="Phone" src={src} width={PHONE_W} height={PHONE_H} className="block rounded-[34px] bg-parchment" />
    </div>
  )
}

/** The shared screen at 1920 × 1080, scaled to fit, beside the phone. */
function Both({ presenterSrc, phoneSrc }: { presenterSrc: string; phoneSrc: string }) {
  const [size, setSize] = useState({ w: 1920, h: 1080 })
  useEffect(() => {
    const on = () => setSize({ w: window.innerWidth, h: window.innerHeight })
    on()
    window.addEventListener('resize', on)
    return () => window.removeEventListener('resize', on)
  }, [])
  const gap = 32
  const scale = Math.min((size.w - PHONE_W - 20 - gap * 3) / 1920, (size.h - gap * 2) / 1080)
  return (
    <div className="fixed inset-0 flex items-center justify-center gap-8 bg-kinu/60">
      <div className="shrink-0 overflow-hidden rounded-[12px] border border-border-strong shadow-xl" style={{ width: 1920 * scale, height: 1080 * scale }}>
        <iframe title="Presenter screen" src={presenterSrc} width={1920} height={1080} className="block origin-top-left" style={{ transform: `scale(${scale})` }} />
      </div>
      <PhoneFrame src={phoneSrc} />
    </div>
  )
}

/** The board's top: the live banner, and the "Start meeting mode" card in each of its states. */
function MockBoard({ k }: { k: Knobs }) {
  const [now] = useState(() => Date.now())
  const base = buildState(k, now, now)
  const card = (label: string, s: MeetingState) => (
    <div key={label}>
      <p className="mb-2 font-mono text-[12px] uppercase tracking-[0.16em] text-ink-muted">{label}</p>
      <StartMeetingCardView s={s} now={now} busy={false} onStart={noop} />
    </div>
  )
  const before = (agenda: MeetingState['meeting']['agenda'], inMs: number): MeetingState => ({
    ...base,
    cycle: { ...base.cycle, meeting_at: new Date(now + inMs).toISOString() },
    meeting: { ...base.meeting, agenda, startedAt: null, endedAt: null, presenterId: null, currentSegment: null, segmentStartedAt: null },
  })
  const noPrep = AGENDA.map(s => ({ ...s, prep: null }))
  const somePrep = AGENDA.map((s, i) => (i < 5 ? s : { ...s, prep: null }))
  const live = (presenterId: string, presenterName: string | null): MeetingState => ({
    ...base,
    presenterName,
    meeting: { ...base.meeting, startedAt: new Date(now - 20 * 60_000).toISOString(), endedAt: null, presenterId },
  })
  return (
    <div className="min-h-dvh bg-parchment text-ink">
      <MeetingLiveBannerView />
      <div className="mx-auto max-w-3xl space-y-8 px-5 py-10 md:px-10">
        {card('2 h 10 m before, Kers prepped 5 of 7', before(somePrep, 130 * 60_000))}
        {card('40 min before, no prep yet', before(noPrep, 40 * 60_000))}
        {card('Starting now, all prepped', before(AGENDA, 0))}
        {card('No agenda saved', before([], 90 * 60_000))}
        {card('Live, you present', live(base.me, 'you'))}
        {card('Live, someone else presents', live('mock-other-admin', 'ananya'))}
        {card('Live, nobody presents', live('', null))}
      </div>
    </div>
  )
}

// ─── The toolbar ───

const SEG_LABELS = AGENDA.map((s, i) => `${i + 1} · ${s.title.split(':')[0]}`)

function Toolbar({ k, set }: { k: Knobs; set: (p: Partial<Record<keyof Knobs, string | number | boolean>>) => void }) {
  const activityless = k.seg === 3 || k.seg === 7
  return (
    <div className="fixed bottom-28 right-4 z-[2147483000] w-[300px] rounded-[16px] border border-border-strong bg-paper/95 p-3 text-[13px] text-ink shadow-xl backdrop-blur">
      <div className="mb-2 flex items-center">
        <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-muted">Meeting mock</p>
        <p className="ml-auto text-[11px] text-ink-muted">H hides</p>
      </div>
      <div className="grid grid-cols-[72px_1fr] items-center gap-x-2 gap-y-1.5">
        <Pick label="View" value={k.view} options={['presenter', 'phone', 'both', 'board']} onChange={v => set({ view: v })} />
        <Pick label="Segment" value={String(k.seg)} options={AGENDA.map((_, i) => String(i + 1))} labels={SEG_LABELS} onChange={v => set({ seg: v })} />
        <Pick label="Meeting" value={k.meet} options={['pre', 'live', 'ended']} onChange={v => set({ meet: v })} />
        <Pick label="Presenter" value={k.pres} options={['me', 'other']} labels={['me', 'another admin (view only)']} onChange={v => set({ pres: v })} />
        <Pick
          label="Activity"
          value={k.act}
          options={['ready', 'fresh', 'hidden', 'live', 'closed']}
          labels={['ready', 'just opened (real clock)', 'open, < 8 s (poll hidden)', 'open, live counts', 'closed']}
          disabled={activityless}
          onChange={v => set({ act: v })}
        />
        <Pick label="People" value={String(k.n)} options={['1', '8', '20', '40', '60']} onChange={v => set({ n: v })} />
        <Pick label="Time" value={k.time} options={['ontime', '1min', 'over']} labels={['on time', '1 min left', 'overtime']} onChange={v => set({ time: v })} />
        <Pick label="Boss" value={k.boss} options={['intro', 'running', 'verdict']} disabled={k.seg !== 6} onChange={v => set({ boss: v })} />
        <Pick label="Pass %" value={String(k.pct)} options={['0', '40', '62', '100']} disabled={k.seg !== 6} onChange={v => set({ pct: v })} />
        <Pick label="Phone" value={k.phone} options={[...PHONE_STATES]} disabled={k.view === 'presenter' || k.view === 'board'} onChange={v => set({ phone: v })} />
      </div>
      <div className="mt-2.5 flex gap-4 border-t border-border pt-2.5">
        <Check label="Simulate" on={k.sim} onChange={v => set({ sim: v })} />
        <Check label="Dark" on={k.dark} onChange={v => set({ dark: v })} />
      </div>
    </div>
  )
}

function Pick({ label, value, options, labels, disabled, onChange }: { label: string; value: string; options: string[]; labels?: string[]; disabled?: boolean; onChange: (v: string) => void }) {
  const id = `mock-${label.toLowerCase().replace(/\W/g, '')}`
  return (
    <>
      <label htmlFor={id} className={cn('text-ink-muted', disabled && 'opacity-40')}>{label}</label>
      <select
        id={id}
        value={value}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
        className="h-8 min-w-0 rounded-(--radius-control) border border-border bg-parchment px-2 text-[13px] text-ink disabled:opacity-40"
      >
        {options.map((o, i) => <option key={o} value={o}>{labels?.[i] ?? o}</option>)}
      </select>
    </>
  )
}

function Check({ label, on, onChange }: { label: string; on: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex h-8 items-center gap-2">
      <input type="checkbox" checked={on} onChange={e => onChange(e.target.checked)} className="size-4 accent-ink" />
      {label}
    </label>
  )
}
