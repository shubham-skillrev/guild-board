'use client'

import { useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'

export function UsernameSetupModal() {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const [username, setUsername] = useState('')
  const [error, setError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isOpen = searchParams.get('setup') === 'username'
  const isEditMode = searchParams.get('source') === 'profile'

  const hintText = isEditMode
    ? 'Time for a disguise refresh. Pick a playful handle that feels like a secret codename, not your resume name.'
    : 'Make it feel like a secret codename from a hacker movie. Keep your real name out of it and have some fun with it.'

  const validate = (value: string) => {
    if (value.length < 3) return 'Must be at least 3 characters'
    if (value.length > 30) return 'Must be 30 characters or less'
    if (!/^[a-z0-9_]+$/.test(value)) return 'Only lowercase letters, numbers, and underscores'
    return ''
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const validationError = validate(username)
    if (validationError) { setError(validationError); return }

    setIsSubmitting(true)
    setError('')

    try {
      const res = await fetch('/api/auth/setup-username', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username }),
      })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong')
        return
      }

      // Remove setup flag from the current URL without changing the page.
      const params = new URLSearchParams(searchParams.toString())
      params.delete('setup')
      params.delete('source')
      const newUrl = params.toString() ? `${pathname}?${params}` : pathname
      router.replace(newUrl)
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-paper border border-border-strong rounded-xl shadow-2xl p-7 w-full max-w-md mx-4 animate-fade-up">
        <h2 className="text-lg font-semibold text-ink mb-1">Pick a username</h2>
        <p className="text-cha text-[13px] mb-5">
          This is how you&apos;ll appear on GuildBoard.
        </p>
        <div className="mb-5 rounded-xl border border-border bg-kinu/50 px-4 py-3 text-[12px] leading-6 text-ink-soft">
          {hintText}
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="text"
              value={username}
              onChange={e => {
                setUsername(e.target.value.toLowerCase())
                setError(validate(e.target.value.toLowerCase()))
              }}
              placeholder="e.g. dev_wizard or code_ninja"
              className="w-full px-3 py-2 bg-sumi border border-border-strong rounded-lg text-sm text-ink focus:outline-none focus:ring-2 focus:ring-saffron/30 placeholder:text-cha transition-all"
              autoFocus
              autoComplete="off"
            />
            {error && <p className="text-vermillion text-[13px] mt-1">{error}</p>}
          </div>
          <button
            type="submit"
            disabled={isSubmitting || !!validate(username)}
            className="w-full py-2.5 bg-saffron text-parchment rounded-lg text-[13px] font-semibold hover:bg-saffron/90 disabled:opacity-50 transition-all"
          >
            {isSubmitting ? 'Saving...' : isEditMode ? 'Update username' : 'Lock it in'}
          </button>
        </form>
      </div>
    </div>
  )
}
