import Link from 'next/link'
import { BoardWall, Marker } from '@/components/landing/BoardWall'
import { SessionCountdown } from '@/components/landing/SessionCountdown'
import { ShareCta } from '@/components/landing/ShareCta'
import {
  Accent,
  WhatPeopleBring,
  HowItWorks,
  ThisMonth,
  BetweenSessions,
  ClosingCta,
} from '@/components/landing/Sections'
import { Wordmark } from '@/components/ui/Wordmark'
import { ThemeToggle } from '@/components/ui/ThemeToggle'
import { PROBLEM_MONTH } from '@/lib/experiment'
import { createClient } from '@/lib/supabase/server'
import { getGuildStatus, getLatestBytes } from '@/lib/landing/guildStatus'
import { enterGuestMode } from '@/app/actions/guest'

/**
 * GuildBoard by SkillRev: where SkillRev talks tech.
 *
 * The page sells a monthly ritual, not an app. Minimal on purpose, in the
 * SkillRev family alongside Aiden: plain headings with one italic accent
 * word, ink buttons, whitespace instead of dividers, and a single moving
 * thing (the composer in the hero).
 */
export default async function LandingPage() {
  const supabase = await createClient()
  const [{ data: { user } }, status, bytes] = await Promise.all([
    supabase.auth.getUser(),
    getGuildStatus(),
    getLatestBytes(),
  ])
  const isAuthed = !!user

  return (
    <div className="min-h-screen bg-parchment flex flex-col font-sans">
      <header className="sticky top-0 z-(--z-chrome) border-b border-border bg-parchment/80 backdrop-blur-xl">
        <div className="flex items-center justify-between h-16 px-(--pad-page-x) max-w-(--measure-wide) mx-auto">
          <Link href="/" aria-label="GuildBoard by SkillRev, home">
            <Wordmark />
          </Link>
          <nav className="flex items-center gap-2 sm:gap-6 text-[14px] shrink-0">
            <a href="#how" className="hidden sm:inline text-ink-soft hover:text-ink transition-colors">
              How it works
            </a>
            <ThemeToggle />
            <Link
              href={isAuthed ? '/board' : '/login'}
              className="press inline-flex items-center h-9 px-4 rounded-full bg-ink text-parchment font-medium whitespace-nowrap hover:bg-ink/85 transition-colors"
            >
              {isAuthed ? (
                <>
                  <span className="sm:hidden">Board</span>
                  <span className="hidden sm:inline">Open the board</span>
                </>
              ) : 'Sign in'}
            </Link>
          </nav>
        </div>
      </header>

      <main className="flex-1">
        {/* ─── Hero ───
            Centred: a live countdown pill, a two-tone headline, one action.
            Then the stat strip and a wall of example posts as the picture. */}
        <section aria-labelledby="hero-title" className="relative overflow-hidden">
          <div aria-hidden className="absolute inset-x-0 top-0 h-[520px] glow-saffron" />
          <div className="relative px-(--pad-page-x) max-w-(--measure-wide) mx-auto pt-16 md:pt-24 text-center">
            <SessionCountdown
              meetingAt={status.meetingAt}
              fallback={
                status.nextSession
                  ? `Next guild session · ${status.nextSession.date}${status.nextSession.time ? `, ${status.nextSession.time}` : ''}`
                  : 'Next guild session date to be announced'
              }
            />

            <h1
              id="hero-title"
              className="mt-7 mx-auto max-w-[15ch] sm:max-w-none text-[2.75rem] sm:text-[3.75rem] lg:text-[4.5rem] font-semibold leading-[1.02] tracking-[-0.045em] text-balance"
            >
              <span className="text-ink">Where SkillRev <Marker><Accent>talks</Accent></Marker> tech.</span>
              <br />
              <span className="text-ink-muted/70">Once a month, out loud.</span>
            </h1>

            <p className="mt-7 mx-auto max-w-[36rem] text-[18px] leading-[1.6] text-ink-soft">
              New tech, old tech, something you learned, a problem you’re stuck on. Put it on the
              board in two lines, then talk it through at the guild.
            </p>

            <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
              <ShareCta isAuthed={isAuthed} boardOpen={status.isOpen} />
              <a
                href="#how"
                className="press inline-flex items-center h-11 px-5 rounded-full border border-border-strong bg-paper text-[14px] font-medium text-ink hover:bg-kinu/50 transition-colors"
              >
                How it works
              </a>
              {/* Guest mode: every member page, read-only, no sign-in. */}
              {!isAuthed && (
                <form action={enterGuestMode}>
                  <button
                    type="submit"
                    className="press inline-flex items-center h-11 px-5 rounded-full text-[14px] font-medium text-ink-soft hover:text-ink hover:bg-kinu/50 transition-colors"
                  >
                    Look around as a guest
                  </button>
                </form>
              )}
            </div>
            <p className="mt-5 text-[13px] text-cha">
              <s className="decoration-vermillion/70 decoration-2">Not another slide deck.</s>{' '}
              Just people talking about what they build.
            </p>

            {/* The stat strip: the whole ask, in numbers. */}
            <dl className="mt-14 mx-auto max-w-[46rem] grid grid-cols-2 sm:grid-cols-4 rounded-(--radius-card) border border-border bg-paper divide-x divide-y sm:divide-y-0 divide-border overflow-hidden">
              {[
                ['5', 'kinds of discussion'],
                ['2', 'lines to post'],
                ['1', 'hour, monthly'],
                [status.isOpen ? String(status.problemCount) : '0', status.isOpen ? 'on the board now' : 'slides required'],
              ].map(([n, label]) => (
                <div key={label} className="px-4 py-5">
                  <dt className="sr-only">{label}</dt>
                  <dd>
                    <span className="block font-mono text-[26px] font-medium tabular-nums text-ink">{n}</span>
                    <span className="mt-1 block text-[12px] text-cha">{label}</span>
                  </dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="relative px-(--pad-page-x) max-w-(--measure-wide) mx-auto mt-16 md:mt-20">
            <BoardWall />
          </div>
        </section>

        <WhatPeopleBring />
        <HowItWorks />
        {PROBLEM_MONTH && <ThisMonth status={status} isAuthed={isAuthed} />}
        <BetweenSessions bytes={bytes} isAuthed={isAuthed} />
        <ClosingCta status={status} isAuthed={isAuthed} />
      </main>

      <footer className="border-t border-border">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 py-6 sm:py-0 sm:h-16 px-(--pad-page-x) max-w-(--measure-wide) mx-auto">
          <Wordmark />
          <p className="text-[12px] text-cha">© 2026 SkillRev · The monthly engineering guild</p>
        </div>
      </footer>
    </div>
  )
}
