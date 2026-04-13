'use client'

export function SignupForm() {
  return (
    <div className="w-full max-w-sm mx-auto bg-paper/80 backdrop-blur-sm p-7 rounded-xl border border-border relative overflow-hidden">
      {/* Accent top line */}
      <div className="absolute top-0 left-0 w-full h-0.5 bg-linear-to-r from-saffron via-wisteria to-indigo-jp opacity-60" />

      <div className="text-center space-y-1.5 mb-6">
        <h2 className="font-serif text-xl font-bold text-ink">
          Join the Guild
        </h2>
        <p className="text-xs text-ink-soft">
          Start pitching ideas and voting on what matters.
        </p>
        <p className="text-[11px] text-cha">Only @skillrev.dev accounts are allowed</p>
      </div>

      <form action="/api/auth/login" method="POST" className="space-y-4">
        <button
          type="submit"
          className="w-full inline-flex items-center justify-center gap-2.5 px-4 py-2.5 bg-sumi border border-border-strong rounded-lg text-ink text-sm font-medium hover:bg-kinu transition-all"
        >
          <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>
        <p className="text-center text-[11px] text-cha">
          One click - you&apos;re in.
        </p>
      </form>
    </div>
  )
}
