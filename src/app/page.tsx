import Link from 'next/link'
import { SignupForm } from '@/components/auth/SignupForm'

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-parchment flex flex-col font-sans">
      {/* Nav */}
      <header className="flex items-center justify-between px-5 md:px-10 h-14 border-b border-border max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-2.5">
          <span className="text-saffron text-base">◈</span>
          <span className="font-serif font-bold text-ink text-base tracking-tight">
            GuildBoard
          </span>
        </div>
        <Link
          href="/login"
          className="px-4 py-2 text-[13px] font-semibold text-ink bg-paper border border-border-strong rounded-lg hover:bg-kinu hover:border-cha transition-all"
        >
          Sign in
        </Link>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col lg:flex-row items-center justify-center pattern-asanoha glow-saffron px-5 md:px-10 gap-16 py-16 lg:py-0">
        <div className="flex-1 max-w-xl text-center lg:text-left space-y-8">
          {/* Tagline chip */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sumi border border-border text-[11px] text-ink-soft uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-matcha animate-pulse-soft" />
            Engineering Guild Platform
          </div>

          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl font-bold text-ink tracking-tight leading-[1.1]">
            Where Guilds Shape<br />
            <span className="text-saffron italic font-normal">What&apos;s Next</span>
          </h1>

          <p className="text-base md:text-lg text-ink-soft leading-relaxed max-w-md mx-auto lg:mx-0">
            Surface ideas. Rally votes. Ship outcomes.
            Your monthly engineering guild meeting, reinvented.
          </p>

          <div className="lg:hidden">
            <Link
              href="/login"
              className="inline-flex items-center justify-center px-5 py-2.5 text-[13px] font-semibold text-parchment bg-saffron rounded-lg hover:bg-saffron/90 transition-all"
            >
              Sign in to continue
            </Link>
          </div>

          {/* Three pillars — Japanese gate-style cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
            <div className="group p-5 bg-paper/60 border border-border hover:border-saffron/30 transition-all rounded-xl">
              <div className="w-8 h-8 rounded-lg bg-saffron/10 flex items-center justify-center text-saffron text-sm mb-3">▲</div>
              <h3 className="text-sm font-semibold text-ink mb-1">Upvote Ideas</h3>
              <p className="text-xs text-ink-soft leading-relaxed">
                3 votes per cycle. Choose wisely.
              </p>
            </div>
            <div className="group p-5 bg-paper/60 border border-border hover:border-matcha/30 transition-all rounded-xl">
              <div className="w-8 h-8 rounded-lg bg-matcha/10 flex items-center justify-center text-matcha text-sm mb-3">🤝</div>
              <h3 className="text-sm font-semibold text-ink mb-1">Raise Your Hand</h3>
              <p className="text-xs text-ink-soft leading-relaxed">
                Volunteer to lead the discussion.
              </p>
            </div>
            <div className="group p-5 bg-paper/60 border border-border hover:border-wisteria/30 transition-all rounded-xl">
              <div className="w-8 h-8 rounded-lg bg-wisteria/10 flex items-center justify-center text-wisteria text-sm mb-3">⚡</div>
              <h3 className="text-sm font-semibold text-ink mb-1">Earn Sparks</h3>
              <p className="text-xs text-ink-soft leading-relaxed">
                Great contributors get recognized.
              </p>
            </div>
          </div>
        </div>

        {/* Signup Form */}
        <div className="hidden lg:block w-full lg:max-w-sm pt-4 lg:pt-0">
          <SignupForm />
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-border px-5 py-5 mt-auto">
        <p className="text-[11px] text-cha text-center tracking-wider uppercase">
          GuildBoard <span className="mx-1.5 text-border-strong">·</span> Crafted for builders
        </p>
      </footer>
    </div>
  )
}
