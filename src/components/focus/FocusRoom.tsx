'use client'

import { useEffect, useRef, useState } from 'react'
import { Pause, Play, ArrowCounterClockwise, SkipForward, Bell, SpeakerSimpleHigh, SpeakerSimpleSlash, Drop, Eye, PersonSimpleWalk, Timer, X } from '@phosphor-icons/react/dist/ssr'
import { Button } from '@/components/ui/Button'
import { PageHeader, StatStrip, StatChip } from '@/components/ui/Section'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { cn } from '@/lib/utils/cn'
import { botSays } from '@/lib/guildbot-host/voice'
import { BREAKS, PLANS, ROUTINES, focus, formatClock, stepAt, useFocusState, useRemaining, useTodayStats, type BreakKind, type Plan } from '@/lib/focus/store'
import { breakParty, useRoom, type Person } from '@/lib/focus/presence'
import { playAmbience, saveAmbience, savedAmbience, type Ambience } from '@/lib/focus/sound'
import { isChimeMuted, setChimeMuted } from '@/components/focus/FocusAlerts'
import { CREW_TINTS } from '@/components/kers/look'
import { Kers } from '@/components/kers/Kers'

/**
 * The focus page: work in blocks next to GuildBot. He leaves his corner for
 * the slot on this page (GuildBotStage): while you focus he codes; when the
 * block ends he picks a break and leads it, step by step. Underneath the
 * timer, a little crowd: how many members are focusing right now, as
 * anonymous cursors (lib/focus/presence.ts, members only). Your timer and
 * numbers live in this browser (lib/focus/store.ts).
 */
export function FocusRoom() {
  const state = useFocusState()
  const left = useRemaining(state.endsAt, state.pausedLeft)
  const guideLeft = useRemaining(state.guideEndsAt)
  const stats = useTodayStats()
  const room = useRoom()
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

  // He says what's happening now: the one GuildBot, sitting in the slot below.
  const breakKind = state.phase === 'break' ? state.breakKind : null
  useEffect(() => {
    const key = state.phase === 'focus' ? 'focus.start' : breakKind ? `break.${breakKind}` : null
    if (!key) return
    const id = setTimeout(() => window.dispatchEvent(new CustomEvent('gb:say', { detail: { key } })), 300)
    return () => clearTimeout(id)
  }, [state.phase, breakKind])

  const running = state.endsAt !== null
  const paused = state.pausedLeft !== null
  const plan = PLANS[state.plan]
  const total = (state.phase === 'break' ? plan.rest : plan.focus) * 60_000
  const shown = state.phase === 'idle' ? total : left
  const guiding = state.phase === 'break' && !!state.guideEndsAt && guideLeft > 0
  const guided = state.phase === 'break' && !!state.guideEndsAt && guideLeft <= 0

  const others = room.connected ? room.people.filter(p => !p.you) : []
  const onBreak = others.filter(p => p.s === 'break').length

  // A break party (three or more breaks begun within a minute), announced once.
  const party = breakParty(room.people)
  const partied = useRef(false)
  useEffect(() => {
    if (!party) { partied.current = false; return }
    if (partied.current || state.phase !== 'break') return
    partied.current = true
    window.dispatchEvent(new CustomEvent('gb:say', { detail: { key: 'focus.party', vars: { n: party } } }))
  }, [party, state.phase])

  // Others going on a break while you're mid-block: a quiet offer, once a block.
  const nudge = state.phase === 'focus' && running && onBreak >= 3 && nudgeGone !== state.endsAt
    ? botSays('focus.nudge', String(state.endsAt), 'ui', { n: onBreak })
    : null

  return (
    <>
      <PageHeader
        title="Focus"
        subtitle="Work in blocks with GuildBot. He codes next to you, then makes you take a proper break. It all stays in this browser."
      />

      <div className="rounded-(--radius-card) border border-border bg-paper p-(--pad-card) md:p-6 grid gap-6 md:grid-cols-[1fr_1.1fr] md:items-center [&>*]:min-w-0">
        {/* GuildBot's spot: he leaves his corner and works from here (GuildBotStage). */}
        <div className="flex justify-center pt-16">
          <div id="gb-focus-slot" aria-hidden className="w-[260px] h-[195px]" />
        </div>

        {/* The timer. */}
        <div className="flex flex-col gap-4 min-w-0">
          <div>
            <p className="text-footnote text-ink-soft">
              {state.phase === 'idle' ? 'Ready when you are' : state.phase === 'focus' ? (paused ? 'Focus, paused' : 'Focusing') : paused ? 'Break, paused' : 'Break'}
            </p>
            <p className="font-mono tabular-nums text-[56px] leading-none tracking-tight text-ink mt-1" aria-live="off">
              {formatClock(shown)}
            </p>
          </div>

          {state.phase === 'idle' && (
            // Short labels so all three fit on a phone; the plan's name is spelled out below.
            <SegmentedControl<Plan>
              label="Plan"
              value={state.plan}
              onChange={focus.setPlan}
              className="self-start max-w-full"
              options={(Object.keys(PLANS) as Plan[]).map(k => ({ key: k, label: `${PLANS[k].focus}/${PLANS[k].rest}` }))}
            />
          )}
          <p className="-mt-2 text-caption text-cha">{plan.label}: {plan.focus} minutes on, {plan.rest} off</p>

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
                <Button variant="ghost" icon={ArrowCounterClockwise} onClick={focus.reset}>Reset</Button>
              </>
            )}
          </div>

          {state.phase === 'break' && breakKind && (
            <BreakGuide kind={breakKind} guiding={guiding} guided={guided} left={guideLeft} />
          )}

          <Crowd
            member={room.member}
            others={others}
            you={running ? (state.phase === 'break' ? 'break' : 'focus') : null}
            yourLook={room.people.find(p => p.you)?.look ?? 0}
          />
        </div>
      </div>

      {/* Others going on a break while you're mid-block. */}
      {nudge && (
        <div role="status" className="mt-3 flex items-center gap-3 rounded-(--radius-card) border border-border bg-paper px-4 py-2.5 shadow-sm animate-fade-up">
          <p className="flex-1 text-footnote text-ink">{nudge}</p>
          <Button variant="tinted" onClick={focus.skip}>Join them</Button>
          <button type="button" onClick={() => setNudgeGone(state.endsAt)} aria-label="Not now" className="press text-cha hover:text-ink"><X size={16} /></button>
        </div>
      )}

      {/* Today. */}
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
        Your numbers stay in this browser and reset each day. Nobody else sees them, GuildBot included. The crowd is anonymous: a count, never names.
      </p>
    </>
  )
}

const SHOWN = 6

/**
 * Who's focusing right now, as a little crowd of anonymous cursors (Kers's
 * build, filled with a random dye): one per member with a timer running
 * (yours in front, saffron-ringed), at work or dancing on a break, and the
 * count in words.
 */
function Crowd({ member, others, you, yourLook }: { member: boolean; others: Person[]; you: 'focus' | 'break' | null; yourLook: number }) {
  if (!member) {
    return <p className="text-caption text-cha">Sign in to see how many of the guild are focusing with you.</p>
  }
  const focusing = others.filter(p => p.s === 'focus').length
  const breaking = others.length - focusing
  const shown = [...others].sort((a, b) => a.since - b.since).slice(0, SHOWN)
  const words = others.length === 0
    ? you ? 'Just you and GuildBot right now. Quality over quantity.' : 'Nobody focusing right now. First one in gets the good chair.'
    : [
        focusing ? `${focusing} focusing${you ? ' with you' : ''}` : null,
        breaking ? `${breaking} on a break` : null,
      ].filter(Boolean).join(', ') + ' right now.'

  return (
    <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3 rounded-xl border border-border bg-sumi px-3 py-2">
      <div className="flex items-end -space-x-1.5 shrink-0 max-w-full overflow-hidden" aria-hidden>
        {you && (
          <span className="relative z-10 rounded-full ring-2 ring-saffron/70 bg-paper">
            <Kers size={30} tint={CREW_TINTS[yourLook % CREW_TINTS.length]} expression={you === 'break' ? 'relieved' : 'nosy'} motion={you === 'break' ? 'hop' : 'idle'} />
          </span>
        )}
        {shown.map(p => (
          <span key={p.key} className="relative rounded-full bg-paper ring-2 ring-paper">
            <Kers
              size={30}
              tint={CREW_TINTS[p.look % CREW_TINTS.length]}
              expression={p.s === 'break' ? 'relieved' : 'nosy'}
              motion={p.s === 'break' ? 'dance' : 'idle'}
            />
          </span>
        ))}
        {others.length > SHOWN && (
          <span className="relative grid place-items-center h-[30px] min-w-[30px] px-1 rounded-full bg-kinu ring-2 ring-paper text-[11px] font-semibold text-ink-soft tabular-nums">
            +{others.length - SHOWN}
          </span>
        )}
      </div>
      <p className="text-footnote text-ink-soft leading-snug">{words}</p>
    </div>
  )
}

/** The break he picked (one tap to swap), then its steps, a cue and a countdown each. */
function BreakGuide({ kind, guiding, guided, left }: { kind: BreakKind; guiding: boolean; guided: boolean; left: number }) {
  const now = guiding ? stepAt(kind, left) : null
  const steps = ROUTINES[kind].steps
  const progress = guiding ? 1 - left / (BREAKS[kind].seconds * 1000) : guided ? 1 : 0
  return (
    <div className="rounded-(--radius-card) border border-border bg-sumi p-3 space-y-2.5">
      {now ? (
        <div className="flex items-start gap-3">
          {kind === 'water' && <Glass fill={progress} />}
          <div className="flex-1 min-w-0">
            <p className="text-caption text-cha">Step {now.index + 1} of {steps.length} · <span className="tabular-nums">{formatClock(now.left)}</span></p>
            <p className="mt-0.5 text-footnote text-ink leading-snug">{now.step.cue}</p>
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
      <div className="flex flex-wrap gap-2">
        {(Object.keys(BREAKS) as BreakKind[]).map(k => (
          <button
            key={k}
            type="button"
            onClick={() => focus.pickBreak(k)}
            aria-pressed={kind === k}
            className={cn(
              'press inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-footnote transition-colors',
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
