import Link from 'next/link'
import { KINDS } from '@/lib/kinds'
import { ShareCta } from '@/components/landing/ShareCta'
import { ComposerDemo } from '@/components/landing/ComposerDemo'
import type { GuildStatus, LandingByte } from '@/lib/landing/guildStatus'
import type { CycleTheme } from '@/lib/themes'

/*
 * The landing page below the hero, in reading order:
 *   what people bring → how it works → this month → between sessions → CTA
 * Short sections, plain words, one accent word per heading. Whitespace does
 * the separating; there are no dividers between sections.
 *
 * All server components. The only motion is the CSS `.reveal` scroll fade.
 */

/* ─── Shared furniture ─────────────────────────────────────── */

/** Small section label in the accent colour. */
export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="eyebrow text-saffron!">{children}</p>
}

/** The one italic serif word a heading leans on. */
export function Accent({ children }: { children: React.ReactNode }) {
  return <span className="accent-word">{children}</span>
}

function Section({ id, labelledBy, children }: { id?: string; labelledBy: string; children: React.ReactNode }) {
  return (
    <section id={id} aria-labelledby={labelledBy} className="scroll-mt-20">
      <div className="reveal px-(--pad-page-x) max-w-(--measure-wide) mx-auto py-20 md:py-28">{children}</div>
    </section>
  )
}

function H2({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="mt-5 text-[2rem] md:text-[2.75rem] font-semibold leading-[1.08] tracking-[-0.035em] text-ink text-balance">
      {children}
    </h2>
  )
}

export function sessionLine(status: GuildStatus): string {
  const when = status.nextSession
    ? `${status.nextSession.date}${status.nextSession.time ? `, ${status.nextSession.time}` : ''}`
    : 'date to be announced'
  const count = status.isOpen
    ? ` · ${status.problemCount === 0 ? 'nothing on the board yet' : `${status.problemCount} on the board`}`
    : ''
  return `Next session · ${when}${count}`
}

export function SessionLine({ status, className }: { status: GuildStatus; className?: string }) {
  return (
    <p className={`flex items-center gap-2 text-[13px] text-cha ${className ?? ''}`}>
      <span aria-hidden className={`w-1.5 h-1.5 rounded-full ${status.isOpen ? 'bg-matcha' : 'bg-ink-muted'}`} />
      {sessionLine(status)}
    </p>
  )
}

/* ─── 2 · What people bring ──────────────────────────────── */

export function WhatPeopleBring() {
  return (
    <Section labelledBy="bring-title">
      <div className="grid lg:grid-cols-12 gap-12 lg:gap-14 items-center">
        <div className="lg:col-span-6">
          <Eyebrow>What people bring</Eyebrow>
          <H2 id="bring-title">
            Anything worth <Accent>talking</Accent> about.
          </H2>
          <p className="mt-5 max-w-[30rem] text-[16px] leading-[1.6] text-ink-soft">
            Pick what you’re bringing and answer two questions. The form asks the right two for
            the kind.
          </p>
          <dl className="mt-9 divide-y divide-border border-y border-border">
            {KINDS.map(k => (
              <div key={k.value} className="grid grid-cols-[7.5rem_1fr] gap-x-6 py-3.5">
                <dt className="text-[14px] font-medium text-ink">{k.label}</dt>
                <dd className="text-[14px] text-ink-soft">{k.first.label}</dd>
              </div>
            ))}
          </dl>
        </div>
        <div className="lg:col-span-6">
          <ComposerDemo />
        </div>
      </div>
    </Section>
  )
}

/* ─── 3 · How it works ───────────────────────────────────── */

const STEPS = [
  { n: '01', title: 'Post', body: 'Two lines is enough. Say what it is and why it’s interesting.' },
  { n: '02', title: 'React', body: 'Mark what you want to talk about. The board ranks itself.' },
  { n: '03', title: 'Talk', body: 'The most-marked go on the agenda. Small groups, out loud, once a month.' },
]

export function HowItWorks() {
  return (
    <Section id="how" labelledBy="how-title">
      <Eyebrow>How it works</Eyebrow>
      <H2 id="how-title">
        One board. One <Accent>hour</Accent>.
      </H2>
      <ol className="mt-12 grid md:grid-cols-3 gap-10 md:gap-12">
        {STEPS.map(s => (
          <li key={s.n}>
            <p className="font-mono text-[12px] text-cha">{s.n}</p>
            <p className="mt-3 text-[17px] font-semibold tracking-[-0.01em] text-ink">{s.title}</p>
            <p className="mt-2 text-[15px] leading-[1.6] text-ink-soft max-w-[20rem]">{s.body}</p>
          </li>
        ))}
      </ol>
    </Section>
  )
}

/* ─── 4 · This month ─────────────────────────────────────────
   The only section that changes with the month: it is the cycle's theme,
   word for word. A month with no theme has no section (see page.tsx). */

export function ThisMonth({ status, isAuthed, theme }: { status: GuildStatus; isAuthed: boolean; theme: CycleTheme }) {
  const month = status.month ? status.month[0].toUpperCase() + status.month.slice(1) : 'This month'
  return (
    <Section labelledBy="month-title">
      <div className="rounded-(--radius-card) border border-border bg-paper px-6 py-10 md:px-12 md:py-14">
        <Eyebrow>This month · {month}</Eyebrow>
        <H2 id="month-title">
          <AccentTitle title={theme.title} accent={theme.accent} />
        </H2>
        <p className="mt-5 max-w-[36rem] text-[17px] leading-[1.6] text-ink-soft">
          {theme.blurb}
        </p>
        <div className="mt-8">
          <ShareCta isAuthed={isAuthed} boardOpen={status.isOpen} label={theme.cta} />
        </div>
      </div>
    </Section>
  )
}

/** The title with its accent word (first match, any case) in the display italic. */
function AccentTitle({ title, accent }: { title: string; accent?: string }) {
  const at = accent ? title.toLowerCase().indexOf(accent.toLowerCase()) : -1
  if (!accent || at < 0) return <>{title}</>
  return (
    <>
      {title.slice(0, at)}
      <Accent>{title.slice(at, at + accent.length)}</Accent>
      {title.slice(at + accent.length)}
    </>
  )
}

/* ─── 5 · Between sessions (Bytes) ───────────────────────── */

export function BetweenSessions({ bytes, isAuthed }: { bytes: LandingByte[]; isAuthed: boolean }) {
  if (bytes.length === 0) return null
  return (
    <Section labelledBy="bytes-title">
      <div className="grid lg:grid-cols-12 gap-10 lg:gap-12 items-start">
        <div className="lg:col-span-5">
          <Eyebrow>Between sessions</Eyebrow>
          <H2 id="bytes-title">
            Something to read <Accent>before</Accent> the next one.
          </H2>
          <p className="mt-5 max-w-[28rem] text-[15px] leading-[1.6] text-ink-soft">
            Bytes: a short digest of engineering reads, every other morning.
          </p>
          <Link
            href={isAuthed ? '/bytes' : '/login'}
            className="mt-6 inline-flex items-center gap-1.5 text-[14px] font-medium text-ink hover:text-saffron transition-colors"
          >
            Open Bytes <span aria-hidden>→</span>
          </Link>
        </div>
        <ol className="lg:col-span-7 divide-y divide-border border-y border-border">
          {bytes.map(b => (
            <li key={b.id}>
              <a
                href={b.url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-start justify-between gap-6 py-5"
              >
                <span className="min-w-0">
                  <span className="block eyebrow">{b.source}</span>
                  <span className="mt-1.5 block text-[16px] leading-snug text-ink group-hover:text-saffron transition-colors">
                    {b.title}
                  </span>
                </span>
                <span aria-hidden className="text-cha group-hover:text-saffron transition-colors pt-5">↗</span>
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </li>
          ))}
        </ol>
      </div>
    </Section>
  )
}

/* ─── 6 · Closing CTA ────────────────────────────────────── */

export function ClosingCta({ status, isAuthed }: { status: GuildStatus; isAuthed: boolean }) {
  return (
    <section aria-labelledby="cta-title">
      <div className="reveal px-(--pad-page-x) max-w-(--measure-read) mx-auto pt-16 pb-28 md:pt-20 md:pb-36 text-center">
        <h2 id="cta-title" className="text-[2rem] md:text-[3rem] font-semibold leading-[1.06] tracking-[-0.04em] text-ink text-balance">
          Bring <Accent>one</Accent> thing to talk about.
        </h2>
        <div className="mt-9 flex justify-center">
          <ShareCta isAuthed={isAuthed} boardOpen={status.isOpen} />
        </div>
        <SessionLine status={status} className="mt-6 justify-center" />
      </div>
    </section>
  )
}
