'use client'

import { useEffect, useState } from 'react'
import { Pause, Play, ArrowCounterClockwise, SkipForward, Bell, SpeakerSimpleHigh, SpeakerSimpleSlash, Drop, Eye, PersonSimpleWalk, Timer } from '@phosphor-icons/react/dist/ssr'
import type { Expression } from '@guildboard/guildbot'
import { Button } from '@/components/ui/Button'
import { PageHeader, StatStrip, StatChip } from '@/components/ui/Section'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { GuildBotScene, useActivity, type Scene } from '@/components/guildbot/GuildBotScene'
import { botSays } from '@/lib/guildbot-host/voice'
import { cn } from '@/lib/utils/cn'
import { BREAKS, PLANS, focus, formatClock, useFocusState, useRemaining, useTodayStats, type BreakKind, type Plan } from '@/lib/focus/store'
import { isChimeMuted, setChimeMuted } from '@/components/focus/FocusAlerts'

/** What he does on screen during each break. */
const BREAK_SCENE: Record<BreakKind, Scene> = { water: 'coffee', eyes: 'meditating', stretch: 'waking', walk: 'walking' }
const BREAK_FACE: Record<BreakKind, Expression> = { water: 'relieved', eyes: 'relieved', stretch: 'excited', walk: 'proud' }

/**
 * The focus page: work in blocks next to GuildBot. While you focus he codes
 * at his desk; when the block ends he picks a break (water, eyes, stretch,
 * walk), does it on screen, and asks you to join, with a timer for the
 * guided bit. Today's numbers sit underneath. All of it lives in this
 * browser (lib/focus/store.ts).
 */
export function FocusRoom() {
  const state = useFocusState()
  const left = useRemaining(state.endsAt, state.pausedLeft)
  const guideLeft = useRemaining(state.guideEndsAt)
  const stats = useTodayStats()
  const schedule = useActivity() ?? 'coding'
  const [muted, setMuted] = useState(false)
  const [notify, setNotify] = useState<NotificationPermission | 'unsupported'>('default')
  const [line, setLine] = useState<string | null>(null)

  useEffect(() => {
    const id = setTimeout(() => {
      setMuted(isChimeMuted())
      setNotify('Notification' in window ? Notification.permission : 'unsupported')
    }, 0)
    return () => clearTimeout(id)
  }, [])

  // His line for what's happening now.
  const breakKind = state.phase === 'break' ? state.breakKind : null
  useEffect(() => {
    const key = state.phase === 'focus' ? 'focus.start' : breakKind ? (`break.${breakKind}` as const) : null
    const id = setTimeout(() => setLine(key ? botSays(key, `${key}:${state.endsAt ?? state.pausedLeft}`, 'ui') : null), 0)
    return () => clearTimeout(id)
  }, [state.phase, breakKind, state.endsAt, state.pausedLeft])

  const running = state.endsAt !== null
  const paused = state.pausedLeft !== null
  const plan = PLANS[state.plan]
  const total = (state.phase === 'break' ? plan.rest : plan.focus) * 60_000
  const shown = state.phase === 'idle' ? total : left
  const scene: Scene = state.phase === 'focus' ? 'coding' : breakKind ? BREAK_SCENE[breakKind] : schedule
  const guiding = !!state.guideEndsAt && guideLeft > 0

  return (
    <>
      <PageHeader
        title="Focus"
        subtitle="Work in blocks with GuildBot. He codes next to you, then makes you take a proper break. It all stays in this browser."
      />

      <div className="rounded-(--radius-card) border border-border bg-paper p-(--pad-card) md:p-6 grid gap-6 md:grid-cols-[1fr_1.1fr] md:items-center">
        {/* GuildBot, doing what you're doing. */}
        <div className="flex flex-col items-center gap-3">
          {line && (
            <p role="status" className="relative max-w-xs rounded-2xl border border-border-strong bg-paper px-3.5 py-2.5 text-[13px] leading-snug text-ink shadow-sm">
              {line}
              <span aria-hidden className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 h-3 w-3 rotate-45 border-r border-b border-border-strong bg-paper" />
            </p>
          )}
          <GuildBotScene
            scene={scene}
            asks="normal"
            left={null}
            expression={breakKind ? BREAK_FACE[breakKind] : 'smug'}
            reacting={!!breakKind}
            status={state.phase === 'focus' && running ? 'writing' : null}
            width={260}
          />
        </div>

        {/* The timer. */}
        <div className="flex flex-col gap-4">
          <div>
            <p className="text-footnote text-ink-soft">
              {state.phase === 'idle' ? 'Ready when you are' : state.phase === 'focus' ? (paused ? 'Focus, paused' : 'Focusing') : paused ? 'Break, paused' : 'Break'}
            </p>
            <p className="font-mono tabular-nums text-[56px] leading-none tracking-tight text-ink mt-1" aria-live="off">
              {formatClock(shown)}
            </p>
          </div>

          {state.phase === 'idle' ? (
            <SegmentedControl<Plan>
              label="Plan"
              value={state.plan}
              onChange={focus.setPlan}
              options={(Object.keys(PLANS) as Plan[]).map(k => ({ key: k, label: `${PLANS[k].label} ${PLANS[k].focus}/${PLANS[k].rest}` }))}
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
                <Button variant="ghost" icon={ArrowCounterClockwise} onClick={focus.reset}>Reset</Button>
              </>
            )}
          </div>

          {state.phase === 'break' && (
            <div className="rounded-(--radius-card) border border-border bg-sumi p-3 space-y-2.5">
              <p className="text-footnote text-ink">
                {guiding
                  ? <>Doing it together · <span className="tabular-nums">{formatClock(guideLeft)}</span> left</>
                  : 'Pick a break. He goes first.'}
              </p>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(BREAKS) as BreakKind[]).map(k => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => focus.pickBreak(k)}
                    aria-pressed={state.breakKind === k}
                    className={cn(
                      'press inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-footnote transition-colors',
                      state.breakKind === k ? 'border-border-strong bg-paper text-ink' : 'border-border bg-transparent text-ink-soft hover:text-ink',
                    )}
                  >
                    {BREAKS[k].label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Today. */}
      <div className="mt-(--gap-section) flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <StatStrip>
          <StatChip icon={Timer} value={stats?.focusMinutes ?? 0} label="min focused" />
          <StatChip value={stats?.blocks ?? 0} label={stats?.blocks === 1 ? 'block' : 'blocks'} />
          <StatChip icon={Drop} value={stats?.breaks.water ?? 0} label="water" />
          <StatChip icon={Eye} value={stats?.breaks.eyes ?? 0} label="eye breaks" />
          <StatChip icon={PersonSimpleWalk} value={(stats?.breaks.walk ?? 0) + (stats?.breaks.stretch ?? 0)} label="walks & stretches" />
        </StatStrip>
        <div className="flex items-center gap-2">
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
        Your numbers stay in this browser and reset each day. Nobody else sees them, GuildBot included.
      </p>
    </>
  )
}
