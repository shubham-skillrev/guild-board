'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginPageFallback />}>
      <LoginPageContent />
    </Suspense>
  )
}

function LoginPageContent() {
  const [mode, setMode] = useState<'google' | 'email'>('google')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignup, setIsSignup] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const searchParams = useSearchParams()
  const oauthError = searchParams.get('error')
  const oauthErrorMessage =
    oauthError === 'domain_not_allowed'
      ? 'Only @skillrev.dev Google accounts are allowed.'
      : oauthError
        ? 'Google sign-in failed. Please try again.'
        : ''

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const endpoint = isSignup ? '/api/auth/email-signup' : '/api/auth/email-login'
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data.message || 'Authentication failed')
        return
      }

      router.push(data.needsUsernameSetup ? '/board?setup=username' : '/board')
    } catch {
      setError('An error occurred. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-parchment pattern-asanoha glow-saffron">
      <div className="w-full max-w-sm space-y-6 p-8">
        {/* Logo */}
        <div className="text-center space-y-3">
          <div className="text-saffron text-2xl">◈</div>
          <h1 className="font-serif text-2xl font-bold text-ink tracking-tight">
            Welcome back
          </h1>
          <p className="text-sm text-ink-soft">
            Sign in to your engineering guild
          </p>
          <p className="text-[11px] text-cha">Only @skillrev.dev accounts are allowed</p>
        </div>

        {/* Mode Toggle */}
        <div className="flex gap-0.5 bg-sumi p-0.5 rounded-lg border border-border">
          <button
            onClick={() => { setMode('google'); setError('') }}
            className={`flex-1 py-2 px-3 rounded-md text-[13px] font-medium transition-all ${
              mode === 'google'
                ? 'bg-kinu text-ink shadow-sm'
                : 'text-cha hover:text-ink'
            }`}
          >
            Google
          </button>
          <button
            onClick={() => { setMode('email'); setError('') }}
            className={`flex-1 py-2 px-3 rounded-md text-[13px] font-medium transition-all ${
              mode === 'email'
                ? 'bg-kinu text-ink shadow-sm'
                : 'text-cha hover:text-ink'
            }`}
          >
            Email
          </button>
        </div>

        {/* Google OAuth */}
        {mode === 'google' && (
          <form action="/api/auth/login" method="POST" className="space-y-3">
            <button
              type="submit"
              className="w-full inline-flex items-center justify-center gap-3 px-5 py-2.5 bg-paper border border-border-strong rounded-lg text-ink text-sm font-medium hover:bg-kinu transition-all"
            >
              <svg className="w-4.5 h-4.5" viewBox="0 0 24 24" aria-hidden="true">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Sign in with Google
            </button>
            {oauthErrorMessage && (
              <div className="p-3 bg-vermillion-light border border-vermillion/20 rounded-lg text-xs text-vermillion">
                {oauthErrorMessage}
              </div>
            )}
          </form>
        )}

        {/* Email/Password Form */}
        {mode === 'email' && (
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-xs font-medium text-ink-soft mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-3 py-2 bg-sumi border border-border-strong rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-saffron/30 focus:border-saffron/50 placeholder:text-cha transition-all"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-medium text-ink-soft mb-1.5">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-3 py-2 bg-sumi border border-border-strong rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-saffron/30 focus:border-saffron/50 placeholder:text-cha transition-all"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="p-3 bg-vermillion-light border border-vermillion/20 rounded-lg text-xs text-vermillion">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-saffron text-parchment rounded-lg text-sm font-semibold hover:bg-saffron/90 disabled:opacity-50 transition-all"
            >
              {loading ? 'Signing in...' : isSignup ? 'Create Account' : 'Sign In'}
            </button>

            <div className="text-center">
              <button
                type="button"
                onClick={() => { setIsSignup(!isSignup); setError('') }}
                className="text-[13px] text-saffron/80 hover:text-saffron transition-colors"
              >
                {isSignup ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}

function LoginPageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-parchment pattern-asanoha glow-saffron">
      <div className="w-full max-w-sm p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-6 w-32 mx-auto rounded bg-kinu/60" />
          <div className="h-10 rounded-lg bg-kinu/60" />
          <div className="h-10 rounded-lg bg-kinu/60" />
          <div className="h-10 rounded-lg bg-kinu/60" />
        </div>
      </div>
    </div>
  )
}
