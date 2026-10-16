'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Pause, Play, ArrowCounterClockwise, SkipForward, Bell, SpeakerSimpleHigh, SpeakerSimpleSlash, Drop, Eye, PersonSimpleWalk, Timer, X } from '@phosphor-icons/react/dist/ssr'
import { raining } from '@guildboard/guildbot'
import { Button } from '@/components/ui/Button'
import { PageHeader, StatStrip, StatChip } from '@/components/ui/Section'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { cn } from '@/lib/utils/cn'
import { botSays } from '@/lib/guildbot-host/voice'
import { BREAKS, PLANS, ROUTINES, focus, formatClock, stepAt, useFocusState, useRemaining, useTodayStats, type BreakKind, type Plan } from '@/lib/focus/store'
import { breakParty, browserKey, seat, useRoom, type Person } from '@/lib/focus/presence'
import { playAmbience, saveAmbience, savedAmbience, type Ambience } from '@/lib/focus/sound'
import { isChimeMuted, setChimeMuted } from '@/components/focus/FocusAlerts'
import { GuildBuilding, STREET } from '@/components/hours/GuildBuilding'
import { useWeather } from '@/components/guildbot/useWeather'
import { sceneAt } from '@/lib/hours/scenes'

/**
 * The focus room is the guild building. Every lit window is a member whose
 * focus timer is running right now, anywhere in the app: warm while they
 * focus, TV-blue on a break. Nobody is named; your own window is marked
 * "you", on your screen only. GuildBot works from his shop window
 * downstairs (GuildBotStage sits in the building's slot) and mirrors you:
 * he codes while you focus and leads the break routines.
 *
 * The sky is your clock (the /hours scenes) and your city's weather. When
 * three or more windows go blue together it's a break party; when they go
 * blue while you're mid-block, a quiet nudge offers to join them.
 *
 * Your timer and numbers live in this browser (lib/focus/store.ts); the
 * windows are anonymous presence (lib/focus/presence.ts, members only).
 */
export function FocusRoom() {
  const state = useFocusState()
  const left = useRemaining(state.endsAt, state.pausedLeft)
  const guideLeft = useRemaining(state.guideEndsAt)
  const stats = useTodayStats()
  const room = useRoom()
  const weather = useWeather()
  const hour = useHour()
  const narrow = useNarrow()
  const [muted, setMuted] = useState(false)
  const [notify, setNotify] = useState<NotificationPermission | 'unsupported'>('default')
  const [ambience, setAmbience] = useState<Ambience>('off')
  const [nudgeGone, setNudgeGone] = useState<number | null>(null)

  useEffect(() => {
    const id = setTimeout(() => {
      setMuted(isChimeMuted())
      setNotify('Notification' in window ? Notification.permission : 'unsupported')
      setAmbience(savedAmbience())
    }, 0)
    return () => clearTimeout(id)
  }, [])

  // The sound you picked, while you're here.
  useEffect(() => {
    if (ambience === 'off') return
    return playAmbience(ambience)
  }, [ambience])

  // He says what's happening now: at the start of a block and in breaks, never mid-block.
  const breakKind = state.phase === 'break' ? state.breakKind : null
  useEffect(() => {
    const key = state.phase === 'focus' ? 'focus.start' : breakKind ? `break.${breakKind}` : null
    if (!key) return
    const id = setTimeout(() => window.dispatchEvent(new CustomEvent('gb:say', { detail: { key } })), 300)
    return () => clearTimeout(id)
  }, [state.phase, breakKind])

  const running = state.phase !== 'idle' && state.endsAt !== null
  const paused = state.pausedLeft !== null
  const plan = PLANS[state.plan]
  const total = (state.phase === 'break' ? plan.rest : plan.focus) * 60_000
  const shown = state.phase === 'idle' ? total : left
  const guiding = state.phase === 'break' && !!state.guideEndsAt && guideLeft > 0
  const guided = state.phase === 'break' && !!state.guideEndsAt && guideLeft <= 0

  // The windows: everyone's, and yours even before the channel says so (or
  // if it never will: guests, or the migration not applied yet).
  const people: Person[] = room.connected ? [...room.people] : []
  if (running && !people.some(p => p.you)) {
    people.push({ key: 'you', you: true, s: state.phase === 'break' ? 'break' : 'focus', since: (state.endsAt ?? 0) - total, look: lookOf() })
  }
  const ordered = [...people].sort((a, b) => Number(b.you) - Number(a.you))
  const drawn = narrow ? ordered.slice(0, 8) : ordered
  const seats = seat(drawn, 16)
  const overflow = seats.overflow + (people.length - drawn.length)
  const party = breakParty(people)
  const othersOnBreak = people.filter(p => !p.you && p.s === 'break').length

  // A break party, announced once.
  const partied = useRef(false)
  useEffect(() => {
    if (!party) { partied.current = false; return }
    if (partied.current || state.phase !== 'break') return
    partied.current = true
    window.dispatchEvent(new CustomEvent('gb:say', { detail: { key: 'focus.party', vars: { n: party } } }))
  }, [party, state.phase])

  // Windows going blue while you're mid-block: a quiet offer, once a block.
  const nudge = state.phase === 'focus' && running && othersOnBreak >= 3 && nudgeGone !== state.endsAt
    ? botSays('focus.nudge', String(state.endsAt), 'ui', { n: othersOnBreak })
    : null

  const scene = sceneAt(hour ?? 12)
  const w = weather.weather
  const night = scene.tone === 'light'
  const street = night ? STREET.night : STREET.day

  return (
    <>
      <PageHeader
        title="Focus"
        subtitle="The guild building. Every lit window is someone focusing right now, anonymously. Start a timer and yours lights up, on any page."
      />

      {/* The building, under your sky, with the timer floating on it. */}
      <section
        className="relative overflow-hidden rounded-(--radius-card) border border-border shadow-[0_30px_60px_-30px_rgba(0,0,0,0.5)]"
        style={{ background: `linear-gradient(to bottom, ${scene.sky[0]}, ${scene.sky[1]})`, ['--sky-top' as string]: scene.sky[0] }}
      >
        {/* The street runs on past the drawing (desktop). */}
        <div aria-hidden className="hidden md:block absolute inset-x-0 bottom-0 h-[12.73%]">
          <div className="h-[32%]" style={{ background: street.pavement }} />
          <div className="h-[68%]" style={{ background: street.road }} />
        </div>

        <div className="relative md:grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)] md:items-center">
          <div className="p-4 md:p-6 bg-(--sky-top) md:bg-transparent md:self-start md:pt-10">
            <div className="rounded-2xl border border-border bg-paper/90 backdrop-blur-md p-4 md:p-5 shadow-[0_16px_40px_-16px_rgba(0,0,0,0.45)] flex flex-col gap-4">
              <div>
                <p className="text-footnote text-ink-soft">
                  {state.phase === 'idle' ? 'Ready when you are' : state.phase === 'focus' ? (paused ? 'Focus, paused' : 'Focusing') : paused ? 'Break, paused' : 'Break'}
                </p>
                <p className="font-mono tabular-nums text-[48px] md:text-[56px] leading-none tracking-tight text-ink mt-1" aria-live="off">
                  {formatClock(shown)}
                </p>
                <p className="mt-1.5 text-caption text-cha">
                  {hour !== null && <ClockNow />}
                  {w && <> · {w.city} {w.temperature}°C</>}
                </p>
              </div>

              {state.phase === 'idle' ? (
                <SegmentedControl<Plan>
                  label="Plan"
                  value={state.plan}
                  onChange={focus.setPlan}
                  options={(Object.keys(PLANS) as Plan[]).map(k => ({ key: k, label: `${PLANS[k].focus}/${PLANS[k].rest}` }))}
                />
              ) : (
                <p className="text-caption text-cha">{plan.label}: {plan.focus} minutes on, {plan.rest} off</p>
              )}

              <div className="flex flex-wrap items-center gap-2">
                {state.phase === 'idle' ? (
                  <Button icon={Play} onClick={focus.start}>Start focus</Button>
                ) : running ? (
                  <Button variant="tinted" icon={Pause} onClick={focus.pause}>Pause</Button>
                ) : (
                  <Button icon={Play} onClick={focus.resume}>Resume</Button>
                )}
                {state.phase !== 'idle' && (
                  <>
                    <Button variant="ghost" icon={SkipForward} onClick={focus.skip}>{state.phase === 'focus' ? 'Break now' : 'End break'}</Button>
                    <Button variant="ghost" icon={ArrowCounterClockwise} onClick={focus.reset} aria-label="Reset" />
                  </>
                )}
              </div>

              {state.phase === 'break' && breakKind && (
                <BreakGuide kind={breakKind} guiding={guiding} guided={guided} left={guideLeft} />
              )}
            </div>
          </div>

          <div className="relative">
            <GuildBuilding
              scene={scene}
              people={seats.windows}
              overflow={overflow}
              slot
              rain={!!w && raining(w.code)}
              party={party > 0}
              className="gb-building block w-full h-auto"
            />
          </div>
        </div>
      </section>

      {/* A nudge: windows going blue while you're mid-block. */}
      {nudge && (
        <div role="status" className="mt-3 flex items-center gap-3 rounded-(--radius-card) border border-border bg-paper px-4 py-2.5 shadow-sm animate-fade-up">
          <p className="flex-1 text-footnote text-ink">{nudge}</p>
          <Button variant="tinted" onClick={focus.skip}>Join them</Button>
          <button type="button" onClick={() => setNudgeGone(state.endsAt)} aria-label="Not now" className="press text-cha hover:text-ink"><X size={16} /></button>
        </div>
      )}

      {!room.member && (
        <p className="mt-3 text-caption text-cha">Sign in to see the guild&rsquo;s windows. Yours lights up either way.</p>
      )}

      {/* Today, and the room's settings. */}
      <div className="mt-(--gap-section) flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <StatStrip>
          <StatChip icon={Timer} value={stats?.focusMinutes ?? 0} label="min focused" />
          <StatChip value={stats?.blocks ?? 0} label={stats?.blocks === 1 ? 'block' : 'blocks'} />
          <StatChip icon={Drop} value={stats?.breaks.water ?? 0} label="water" />
          <StatChip icon={Eye} value={stats?.breaks.eyes ?? 0} label="eye breaks" />
          <StatChip icon={PersonSimpleWalk} value={(stats?.breaks.walk ?? 0) + (stats?.breaks.stretch ?? 0)} label="walks & stretches" />
        </StatStrip>
        <div className="flex flex-wrap items-center gap-2">
          <SegmentedControl<Ambience>
            label="Background sound"
            value={ambience}
            onChange={a => { saveAmbience(a); setAmbience(a) }}
            options={[{ key: 'off', label: 'Quiet' }, { key: 'rain', label: 'Rain' }, { key: 'brown', label: 'Brown noise' }, { key: 'cafe', label: 'Café' }]}
          />
          <Button
            variant="ghost"
            icon={muted ? SpeakerSimpleSlash : SpeakerSimpleHigh}
            onClick={() => { setChimeMuted(!muted); setMuted(!muted) }}
          >
            {muted ? 'Chime off' : 'Chime on'}
          </Button>
          {notify === 'default' && (
            <Button variant="ghost" icon={Bell} onClick={() => Notification.requestPermission().then(setNotify)}>
              Notify me
            </Button>
          )}
        </div>
      </div>
      <p className="mt-3 text-caption text-cha">
        Your numbers stay in this browser and reset each day. The windows are anonymous: no names, just a plush at a laptop.
      </p>
    </>
  )
}

/** The break he picked (one tap to swap), then its steps, a cue and a countdown each. */
function BreakGuide({ kind, guiding, guided, left }: { kind: BreakKind; guiding: boolean; guided: boolean; left: number }) {
  const now = guiding ? stepAt(kind, left) : null
  const steps = ROUTINES[kind].steps
  const progress = guiding ? 1 - left / (BREAKS[kind].seconds * 1000) : guided ? 1 : 0
  return (
    <div className="rounded-xl border border-border bg-sumi p-3 space-y-3">
      {now ? (
        <div className="flex items-start gap-3">
          {kind === 'water' && <Glass fill={progress} />}
          <div className="flex-1 min-w-0">
            <p className="text-caption text-cha">Step {now.index + 1} of {steps.length} · <span className="tabular-nums">{formatClock(now.left)}</span></p>
            <p className="mt-0.5 text-callout text-ink leading-snug">{now.step.cue}</p>
            <div className="mt-2 flex gap-1" aria-hidden>
              {steps.map((_, i) => (
                <span key={i} className={cn('h-1 flex-1 rounded-full', i < now.index ? 'bg-ink-soft' : i === now.index ? 'bg-saffron' : 'bg-border')} />
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <p className="text-footnote text-ink">
            {guided ? 'Done. Rest until the break ends, or go again.' : <>His pick: <span className="font-semibold">{ROUTINES[kind].label.toLowerCase()}</span>. He goes first.</>}
          </p>
          {!guided && <Button onClick={() => focus.pickBreak(kind)}>Start</Button>}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {(Object.keys(BREAKS) as BreakKind[]).map(k => (
          <button
            key={k}
            type="button"
            onClick={() => focus.pickBreak(k)}
            aria-pressed={kind === k}
            className={cn(
              'press inline-flex items-center h-7 px-2.5 rounded-full border text-[12px] transition-colors',
              kind === k ? 'border-border-strong bg-paper text-ink' : 'border-border bg-transparent text-ink-soft hover:text-ink',
            )}
          >
            {BREAKS[k].label}
          </button>
        ))}
      </div>
    </div>
  )
}

/** A glass that fills as the water break goes on. */
function Glass({ fill }: { fill: number }) {
  const h = 30 * Math.min(1, Math.max(0, fill))
  return (
    <svg viewBox="0 0 28 40" className="w-7 h-10 shrink-0" aria-hidden>
      <defs><clipPath id="gb-glass"><path d="M4 4h20l-2.5 32h-15Z" /></clipPath></defs>
      <rect x={0} y={36 - h} width={28} height={h} fill="#7FB2FF" opacity={0.75} clipPath="url(#gb-glass)" className="transition-[y,height] duration-700" />
      <path d="M4 4h20l-2.5 32h-15Z" fill="none" stroke="currentColor" strokeWidth={1.6} className="text-ink-soft" strokeLinejoin="round" />
    </svg>
  )
}

/** The time where you are, ticking by the minute. */
function ClockNow() {
  const minute = useSyncExternalStore(subscribeMinute, () => Math.floor(Date.now() / 60_000), () => 0)
  return <>{new Date(minute * 60_000).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</>
}

function subscribeMinute(cb: () => void) {
  const id = setInterval(cb, 15_000)
  return () => clearInterval(id)
}

/** Your hour (null until mounted, so the server never guesses your clock). */
function useHour(): number | null {
  return useSyncExternalStore(subscribeMinute, () => new Date().getHours(), () => null)
}

function useNarrow(): boolean {
  return useSyncExternalStore(
    cb => { const m = window.matchMedia('(max-width: 640px)'); m.addEventListener('change', cb); return () => m.removeEventListener('change', cb) },
    () => window.matchMedia('(max-width: 640px)').matches,
    () => false,
  )
}

/** Your plush's look, before the channel has it. */
function lookOf(): number {
  try { return browserKey().look } catch { return 0 }
}
