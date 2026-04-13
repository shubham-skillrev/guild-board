import Link from 'next/link'
import { SignupForm } from '@/components/auth/SignupForm'
import { createClient } from '@/lib/supabase/server'

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const isAuthed = !!user

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
          href={isAuthed ? '/board' : '/login'}
          className="px-4 py-2 text-[13px] font-semibold text-ink bg-paper border border-border-strong rounded-lg hover:bg-kinu hover:border-cha transition-all"
        >
          {isAuthed ? 'Continue to Board' : 'Sign in'}
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
              href={isAuthed ? '/board' : '/login'}
              className="inline-flex items-center justify-center px-5 py-2.5 text-[13px] font-semibold text-parchment bg-saffron rounded-lg hover:bg-saffron/90 transition-all"
            >
              {isAuthed ? 'Continue to Board' : 'Get Started'}
            </Link>
          </div>

          {/* Three pillars — simple cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 pt-2 sm:pt-4">
            <div className="group p-4 sm:p-5 bg-paper/55 border border-border hover:border-saffron/35 transition-all rounded-2xl sm:rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.22)] sm:shadow-none">
              <div className="flex items-center justify-center sm:block gap-3 sm:gap-0">
                <div className="w-10 h-10 sm:w-8 sm:h-8 rounded-xl sm:rounded-lg bg-saffron/12 flex items-center justify-center text-saffron text-base sm:text-sm shrink-0">▲</div>
                <div className="text-left">
                  <h3 className="text-[15px] sm:text-sm font-semibold text-ink mb-1">Upvote Ideas</h3>
                  <p className="text-[13px] sm:text-xs text-ink-soft leading-relaxed">
                    3 votes per cycle. Choose wisely.
                  </p>
                </div>
              </div>
            </div>
            <div className="group p-4 sm:p-5 bg-paper/55 border border-matcha/35 sm:border-border hover:border-matcha/45 transition-all rounded-2xl sm:rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.22)] sm:shadow-none">
              <div className="flex items-center justify-center sm:block gap-3 sm:gap-0">
                <div className="w-10 h-10 sm:w-8 sm:h-8 rounded-xl sm:rounded-lg bg-matcha/12 flex items-center justify-center text-matcha text-base sm:text-sm shrink-0">🤝</div>
                <div className="text-left">
                  <h3 className="text-[15px] sm:text-sm font-semibold text-ink mb-1">Contribute</h3>
                  <p className="text-[13px] sm:text-xs text-ink-soft leading-relaxed">
                    Volunteer to lead the discussion.
                  </p>
                </div>
              </div>
            </div>
            <div className="group p-4 sm:p-5 bg-paper/55 border border-border hover:border-wisteria/35 transition-all rounded-2xl sm:rounded-xl shadow-[0_8px_24px_rgba(0,0,0,0.22)] sm:shadow-none">
              <div className="flex items-center justify-center sm:block gap-3 sm:gap-0">
                <div className="w-10 h-10 sm:w-8 sm:h-8 rounded-xl sm:rounded-lg bg-wisteria/12 flex items-center justify-center text-wisteria text-base sm:text-sm shrink-0">⚡</div>
                <div className="text-left">
                  <h3 className="text-[15px] sm:text-sm font-semibold text-ink mb-1">Earn Sparks</h3>
                  <p className="text-[13px] sm:text-xs text-ink-soft leading-relaxed">
                    Great contributors get recognized.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Signup Form */}
        <div className="hidden lg:block w-full lg:max-w-sm pt-4 lg:pt-0">
          {isAuthed ? (
            <div className="w-full max-w-sm mx-auto bg-paper/80 backdrop-blur-sm p-7 rounded-xl border border-border relative overflow-hidden">
              <div className="absolute top-0 left-0 w-full h-0.5 bg-linear-to-r from-saffron via-wisteria to-indigo-jp opacity-60" />
              <div className="space-y-3 text-center">
                <h2 className="font-serif text-xl font-bold text-ink">Welcome back</h2>
                <p className="text-xs text-ink-soft">You are already signed in and ready to continue.</p>
                <Link
                  href="/board"
                  className="inline-flex items-center justify-center w-full py-2.5 bg-saffron text-parchment rounded-lg text-sm font-semibold hover:bg-saffron/90 transition-all"
                >
                  Continue to Board
                </Link>
              </div>
            </div>
          ) : (
            <SignupForm />
          )}
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
