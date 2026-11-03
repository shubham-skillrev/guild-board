'use client'

import { useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { Check, LockSimple } from '@phosphor-icons/react/dist/ssr'
import { Button } from '@/components/ui/Button'
import { Input, Label } from '@/components/ui/Input'
import { Kers } from '@/components/kers/Kers'
import { GoogleSignIn } from '@/components/auth/GoogleSignIn'
import { GuildWelcome } from '@/components/welcome/GuildWelcome'
import type { GuildSnapshot } from '@/lib/guild/snapshot'
import { cn } from '@/lib/utils/cn'
import {
  ATTENDED,
  DEMO,
  EMPTY_ANSWERS,
  JOIN_REASONS,
  LIMITS,
  MAX_JOIN_REASONS,
  MEETING_SLOTS,
  ROLES,
  type Option,
  type SurveyAnswers,
} from '@/lib/survey'

export interface SurveyViewer {
  name: string
  email: string
  needsUsername: boolean
}

const QUESTION_COUNT = 7

/** How many of the seven questions have an answer, for the progress meter. */
function answered(a: SurveyAnswers): number {
  return [
    a.role,
    a.attended,
    a.join_reasons.length > 0,
    a.learn_next.trim(),
    a.demo,
    a.nominee_name.trim(),
    a.meeting_slot,
  ].filter(Boolean).length
}

/**
 * The survey: an intro rail with Kers and a live progress meter, beside the
 * questions on one raised card. Mostly taps: every multiple-choice question
 * is a row of native radios or checkboxes dressed as pills, so arrow keys,
 * Space and screen readers behave the way they do on any form. Only name,
 * email and role are required.
 */
export function SurveyForm({
  viewer,
  initial,
  answeredAt,
  closed = false,
  snapshot,
}: {
  /** The guild this month, for the welcome after a newcomer answers. */
  snapshot: GuildSnapshot
  viewer: SurveyViewer | null
  initial: SurveyAnswers | null
  answeredAt: string | null
  /** The organisers closed it: no form, just where the results will be. */
  closed?: boolean
}) {
  const [a, setA] = useState<SurveyAnswers>(
    initial ?? { ...EMPTY_ANSWERS, name: viewer?.name ?? '', email: viewer?.email ?? '' },
  )
  const [website, setWebsite] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)

  const done = answered(a)

  const set = <K extends keyof SurveyAnswers>(key: K, value: SurveyAnswers[K]) =>
    setA(prev => ({ ...prev, [key]: value }))

  const toggleReason = (value: SurveyAnswers['join_reasons'][number]) =>
    set('join_reasons', a.join_reasons.includes(value) ? a.join_reasons.filter(r => r !== value) : [...a.join_reasons, value])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...a, website }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not send your answers.')
      setSent(true)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send your answers.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="max-w-(--measure-wide) mx-auto grid gap-10 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)] lg:gap-16">
      {/* Thin progress line pinned under the header on phones, where the
          rail's meter scrolls away. */}
      {!sent && !closed && (
        <div aria-hidden className="lg:hidden fixed inset-x-0 top-16 z-(--z-chrome) h-0.5">
          <div className="h-full bg-ink transition-[width] duration-500 ease-out" style={{ width: `${(done / QUESTION_COUNT) * 100}%` }} />
        </div>
      )}

      <Rail done={done} busy={busy} sent={sent} closed={closed} />

      <div className="min-w-0">
        {closed ? (
          <div className="elev-2 rounded-[20px] p-8 md:p-12">
            <p className="eyebrow">Survey closed</p>
            <h2 className="mt-4 text-[2rem] font-semibold leading-tight tracking-[-0.03em] text-ink">
              Thanks to everyone who <span className="font-serif italic font-normal">answered</span>.
            </h2>
            <p className="mt-4 max-w-prose text-[15px] leading-relaxed text-ink-soft">
              This round is closed. The totals go up at the next guild meeting, so you&apos;ll see what the rest
              of SkillRev asked for.
            </p>
            <Link
              href="/board"
              className="press mt-8 inline-flex items-center h-11 px-6 rounded-full bg-ink text-parchment text-[15px] font-medium hover:bg-ink/85 transition-colors"
            >
              Open the board
            </Link>
          </div>
        ) : sent ? (
          <ThankYou name={a.name} viewer={viewer} snapshot={snapshot} onEdit={() => setSent(false)} />
        ) : (
          <div className="elev-2 rounded-[20px] p-5 sm:p-8 md:p-10">
            {/* ─── Who you are ───
                The Google button is its own form (a POST to /api/auth/login),
                so it sits above the survey form rather than inside it. */}
            <div className="space-y-4">
              <StepHeading n={0} title="About you" />
              {viewer ? (
                <p className="rounded-(--radius-control) bg-kinu/60 px-3.5 py-3 text-footnote text-ink-soft">
                  Answering as <span className="font-medium text-ink">{viewer.email}</span>
                  {answeredAt && <> · you answered on {formatDate(answeredAt)}. Sending again replaces it.</>}
                </p>
              ) : (
                <>
                  <GoogleSignIn label="Fill in with Google" intent="survey" />
                  <div className="flex items-center gap-3 text-caption text-cha" aria-hidden>
                    <span className="h-px flex-1 bg-border" />
                    or type them in
                    <span className="h-px flex-1 bg-border" />
                  </div>
                </>
              )}
            </div>

            <form onSubmit={submit} className="mt-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <Label htmlFor="survey-name">Name</Label>
                  <Input
                    id="survey-name"
                    autoComplete="name"
                    required
                    maxLength={LIMITS.name}
                    value={a.name}
                    onChange={e => set('name', e.target.value)}
                    className="h-11 text-[15px]"
                  />
                </div>
                <div>
                  <Label htmlFor="survey-email">Work email</Label>
                  <Input
                    id="survey-email"
                    type="email"
                    autoComplete="email"
                    required
                    readOnly={!!viewer}
                    maxLength={LIMITS.email}
                    placeholder="you@skillrev.dev"
                    value={a.email}
                    onChange={e => set('email', e.target.value)}
                    className={cn('h-11 text-[15px]', viewer && 'text-ink-muted')}
                  />
                </div>
              </div>

              {/* Honeypot: hidden from people and from assistive tech. */}
              <div aria-hidden className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
                <label>
                  Website
                  <input tabIndex={-1} autoComplete="off" value={website} onChange={e => setWebsite(e.target.value)} />
                </label>
              </div>

              <Question n={1} title="Your role" required>
                <Choices name="role" label="Your role" options={ROLES} value={a.role} onChange={v => set('role', v)} required />
              </Question>

              <Question n={2} title="Been to a guild meeting?">
                <Choices name="attended" label="Been to a guild meeting?" options={ATTENDED} value={a.attended} onChange={v => set('attended', v)} />
              </Question>

              <Question n={3} title="What would make you join?" hint={`Pick up to ${MAX_JOIN_REASONS}.`}>
                <fieldset className="flex flex-wrap gap-2">
                  <legend className="sr-only">What would make you join? Pick up to {MAX_JOIN_REASONS}</legend>
                  {JOIN_REASONS.map(o => {
                    const checked = a.join_reasons.includes(o.value)
                    const full = !checked && a.join_reasons.length >= MAX_JOIN_REASONS
                    return (
                      <Pill key={o.value} disabled={full}>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={checked}
                          disabled={full}
                          onChange={() => toggleReason(o.value)}
                        />
                        {o.label}
                      </Pill>
                    )
                  })}
                </fieldset>
                <Reveal show={a.join_reasons.includes('other')}>
                  <Label htmlFor="survey-join-other">What else?</Label>
                  <Input
                    id="survey-join-other"
                    maxLength={LIMITS.join_other}
                    value={a.join_other}
                    onChange={e => set('join_other', e.target.value)}
                    className="h-11 text-[15px]"
                  />
                </Reveal>
              </Question>

              <Question n={4} title="One thing you'd want to learn next" htmlFor="survey-learn">
                <Input
                  id="survey-learn"
                  maxLength={LIMITS.learn_next}
                  placeholder="e.g. using AI to write test cases"
                  value={a.learn_next}
                  onChange={e => set('learn_next', e.target.value)}
                  className="h-11 text-[15px]"
                />
              </Question>

              <Question
                n={5}
                title="Could you show something in 5 to 10 minutes?"
                hint="A tool you use, a script that saves you time, a bug that ate your week. No slides needed."
              >
                <Choices name="demo" label="Could you show something?" options={DEMO} value={a.demo} onChange={v => set('demo', v)} />
                <Reveal show={a.demo === 'yes' || a.demo === 'maybe'}>
                  <Label htmlFor="survey-demo-idea">What would you show?</Label>
                  <Input
                    id="survey-demo-idea"
                    maxLength={LIMITS.demo_idea}
                    placeholder={a.demo === 'maybe' ? 'A rough idea is fine' : ''}
                    value={a.demo_idea}
                    onChange={e => set('demo_idea', e.target.value)}
                    className="h-11 text-[15px]"
                  />
                </Reveal>
              </Question>

              <Question
                n={6}
                title="Nominate someone for the Spotlight"
                hint="Someone whose work more people should see. They get an invitation, and can always say no."
              >
                <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                  <div>
                    <Label htmlFor="survey-nominee">Their name</Label>
                    <Input
                      id="survey-nominee"
                      maxLength={LIMITS.nominee_name}
                      value={a.nominee_name}
                      onChange={e => set('nominee_name', e.target.value)}
                      className="h-11 text-[15px]"
                    />
                  </div>
                  <div>
                    <Label htmlFor="survey-nominee-why">Why, in one line</Label>
                    <Input
                      id="survey-nominee-why"
                      maxLength={LIMITS.nominee_why}
                      disabled={!a.nominee_name.trim()}
                      placeholder="e.g. fixed our flaky CI"
                      value={a.nominee_why}
                      onChange={e => set('nominee_why', e.target.value)}
                      className="h-11 text-[15px] disabled:opacity-50"
                    />
                  </div>
                </div>
              </Question>

              <Question n={7} title="Best time for the monthly meeting?">
                <Choices name="meeting_slot" label="Best time for the monthly meeting?" options={MEETING_SLOTS} value={a.meeting_slot} onChange={v => set('meeting_slot', v)} />
              </Question>

              <div className="mt-10 flex flex-col-reverse gap-4 border-t border-separator pt-6 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-footnote text-ink-muted">Only name, email and role are required.</p>
                <Button type="submit" disabled={busy} className="h-11 px-6 text-[15px] pointer-coarse:h-12">
                  {busy ? 'Sending…' : initial ? 'Update my answers' : 'Send answers'}
                </Button>
              </div>
              {error && (
                <p role="alert" className="mt-4 rounded-(--radius-control) bg-vermillion-light px-3.5 py-3 text-footnote text-vermillion">
                  {error}
                </p>
              )}
            </form>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── The rail ───────────────────────────────────────────── */

/**
 * Heading, Kers and the meter. Kers follows the cursor and reacts to the
 * form without saying anything: curious at the start, excited partway,
 * pleased when every question has an answer, thinking while it sends,
 * dancing after.
 */
function Rail({ done, busy, sent, closed }: { done: number; busy: boolean; sent: boolean; closed: boolean }) {
  const all = done === QUESTION_COUNT
  const shown = sent ? QUESTION_COUNT : done
  return (
    <aside className="lg:sticky lg:top-28 lg:self-start">
      <p className="eyebrow">Guild survey · 2 minutes</p>
      <h1 className="mt-4 text-[2.25rem] sm:text-[2.75rem] font-semibold leading-[1.04] tracking-[-0.04em] text-ink text-balance">
        What would make the guild{' '}
        <span className="font-serif italic font-normal tracking-[-0.01em] text-[1.08em]">worth</span> your hour?
      </h1>
      <p className="mt-5 text-[15px] leading-relaxed text-ink-soft">
        Once a month the guild meets for an hour to show what we built, what broke, and what&apos;s new in AI
        and tech. Devs, DevOps, QA, PMs and scrum masters are all welcome. Tell us what would make it
        worth joining.
      </p>

      <div className="mt-8 flex items-center gap-5 rounded-[20px] border border-border bg-paper/70 p-4 backdrop-blur-sm">
        <Kers
          size={84}
          follow
          motion={sent ? 'dance' : 'idle'}
          state={busy ? 'thinking' : all && !sent ? 'pleased' : null}
          expression={sent || done >= 3 ? 'excited' : 'nosy'}
          colour={sent || all ? 'proud' : 'smug'}
        />
        <div className="min-w-0 flex-1">
          <p className="text-footnote text-ink">
            {closed ? 'This round is closed' : sent ? 'All sent' : all ? 'Every question answered' : `${done} of ${QUESTION_COUNT} answered`}
          </p>
          <div
            role="progressbar"
            aria-label="Questions answered"
            aria-valuemin={0}
            aria-valuemax={QUESTION_COUNT}
            aria-valuenow={shown}
            className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-kinu"
          >
            <div
              className="h-full rounded-full bg-ink transition-[width] duration-500 ease-out"
              style={{ width: `${(shown / QUESTION_COUNT) * 100}%` }}
            />
          </div>
        </div>
      </div>

      <ol className="mt-8 hidden space-y-3.5 lg:block">
        {[
          'Totals go up at the next guild meeting, so you see what the rest of SkillRev asked for.',
          'If you can show something, an organiser says hello. Nothing is booked without you.',
          'Nominees get an invitation, never an assignment.',
        ].map((step, i) => (
          <li key={step} className="flex gap-3 text-footnote leading-relaxed text-ink-soft">
            <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-border-strong font-mono text-[10px] text-ink-muted">
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>

      <p className="mt-8 flex items-start gap-2 text-caption leading-relaxed text-ink-muted">
        <LockSimple className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Only the guild organisers see names and emails. The meeting sees totals, never who said what.
      </p>
    </aside>
  )
}

/* ─── Pieces ─────────────────────────────────────────────── */

function StepHeading({ n, title, required }: { n: number; title: string; required?: boolean }) {
  return (
    <span className="flex items-baseline gap-3">
      <span className="font-mono text-[11px] text-cha tabular">{String(n).padStart(2, '0')}</span>
      <span className="text-[17px] font-semibold tracking-[-0.01em] text-ink">{title}</span>
      {required && <span className="text-caption text-ink-muted">required</span>}
    </span>
  )
}

function Question({
  n,
  title,
  hint,
  required,
  htmlFor,
  children,
}: {
  n: number
  title: string
  hint?: string
  required?: boolean
  htmlFor?: string
  children: React.ReactNode
}) {
  const heading = <StepHeading n={n} title={title} required={required} />
  return (
    <section className="mt-9 border-t border-separator pt-8">
      {htmlFor ? <label htmlFor={htmlFor} className="block">{heading}</label> : <h2>{heading}</h2>}
      {hint && <p className="mt-1.5 sm:pl-[30px] text-footnote leading-relaxed text-ink-muted">{hint}</p>}
      <div className="mt-4 sm:pl-[30px]">{children}</div>
    </section>
  )
}

/** Opens a follow-up field under its question, without a jump. */
function Reveal({ show, children }: { show: boolean; children: React.ReactNode }) {
  const reduce = useReducedMotion()
  return (
    <AnimatePresence initial={false}>
      {show && (
        <motion.div
          initial={reduce ? false : { height: 0, opacity: 0 }}
          animate={{ height: 'auto', opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
          transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
          className="overflow-hidden"
        >
          <div className="pt-4">{children}</div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

/** One-of-many as native radios, so arrow keys move the choice. */
function Choices<T extends string>({
  name,
  label,
  options,
  value,
  onChange,
  required,
}: {
  name: string
  label: string
  options: readonly Option<T>[]
  value: T | null
  onChange: (value: T) => void
  required?: boolean
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map(o => (
        <Pill key={o.value}>
          <input
            type="radio"
            name={name}
            className="sr-only"
            value={o.value}
            checked={value === o.value}
            required={required}
            onChange={() => onChange(o.value)}
          />
          {o.label}
        </Pill>
      ))}
    </div>
  )
}

/**
 * A label dressed as a pill; its hidden input carries the state. Chosen pills
 * go ink with a check, and hover only touches the ones not chosen, so a
 * chosen pill under the pointer never loses its text.
 */
function Pill({ disabled, children }: { disabled?: boolean; children: React.ReactNode }) {
  return (
    <label
      className={cn(
        'group press-sm inline-flex items-center gap-1.5 h-9 px-3.5 rounded-full border text-footnote select-none transition-colors',
        'pointer-coarse:h-11 pointer-coarse:px-4',
        'has-checked:bg-ink has-checked:border-ink has-checked:text-parchment',
        'not-has-checked:border-border not-has-checked:bg-paper not-has-checked:text-ink-soft',
        !disabled && 'not-has-checked:hover:text-ink not-has-checked:hover:border-border-strong',
        'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink',
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
      )}
    >
      <Check weight="bold" className="hidden size-3.5 -ml-0.5 group-has-checked:block" aria-hidden />
      {children}
    </label>
  )
}

function ThankYou({ name, viewer, snapshot, onEdit }: { name: string; viewer: SurveyViewer | null; snapshot: GuildSnapshot; onEdit: () => void }) {
  const first = name.trim().split(/\s+/)[0]
  if (viewer) {
    return (
      <div className="elev-2 rounded-[20px] p-8 md:p-12">
        <p className="eyebrow">Answers sent</p>
        <h2 className="mt-4 text-[2rem] font-semibold leading-tight tracking-[-0.03em] text-ink">
          Thanks, <span className="font-serif italic font-normal">{first}</span>.
        </h2>
        <p className="mt-4 max-w-prose text-[15px] leading-relaxed text-ink-soft">
          Totals from everyone&apos;s answers go up at the next guild meeting, so you&apos;ll see what the rest of
          SkillRev asked for. Meanwhile: pitch a topic, or vote on what we talk about next.
        </p>
        <Link
          href={viewer.needsUsername ? '/board?setup=username' : '/board'}
          className="press mt-8 inline-flex items-center h-11 px-6 rounded-full bg-ink text-parchment text-[15px] font-medium hover:bg-ink/85 transition-colors"
        >
          Open the board
        </Link>
        <button type="button" onClick={onEdit} className="mt-6 block text-footnote text-ink-muted underline-offset-2 hover:text-ink hover:underline">
          Change my answers
        </button>
      </div>
    )
  }

  // Someone new: welcome them properly, show them the guild, and make joining one tap.
  return (
    <div className="elev-2 rounded-[20px] p-6 md:p-10">
      <p className="eyebrow">Answers sent · welcome</p>
      <h2 className="mt-4 text-[2rem] font-semibold leading-tight tracking-[-0.03em] text-ink">
        Welcome to the guild, <span className="font-serif italic font-normal">{first}</span>.
      </h2>
      <p className="mt-4 max-w-prose text-[15px] leading-relaxed text-ink-soft">
        You just told us what would make the meeting worth your hour, which already makes you more involved than
        most. Here&apos;s what you&apos;d be joining.
      </p>
      <div className="mt-8">
        <GuildWelcome snapshot={snapshot} />
      </div>
      <div className="mt-8 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
        <GoogleSignIn label="Join the guild with Google" intent="survey" />
        <Link href="/" className="text-center text-footnote text-ink-muted hover:text-ink sm:px-4">Look around first</Link>
      </div>
      <p className="mt-3 text-meta text-ink-muted">
        Once you&apos;re in: vote on what we talk about, put a link on the Radar, or take a Show & Tell slot.
      </p>
      <button type="button" onClick={onEdit} className="mt-6 block text-footnote text-ink-muted underline-offset-2 hover:text-ink hover:underline">
        Change my answers
      </button>
    </div>
  )
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}
