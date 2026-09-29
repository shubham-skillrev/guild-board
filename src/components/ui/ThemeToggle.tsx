'use client'

import { Moon, Sun } from '@phosphor-icons/react/dist/ssr'
import { cn } from '@/lib/utils/cn'

/**
 * Light / dark switch.
 *
 * Holds no React state. The theme lives in one place, the `dark` class on
 * <html> that the root layout's inline script sets before first paint, and
 * the icon follows it through CSS (`dark:`). So the server and client render
 * identical markup and there is nothing to mismatch on hydration.
 *
 * Clicking stores an explicit choice under `gb-theme`, which from then on
 * wins over the OS setting.
 */
export function ThemeToggle({ className }: { className?: string }) {
  const toggle = () => {
    const root = document.documentElement
    const dark = !root.classList.contains('dark')
    root.classList.toggle('dark', dark)
    try { localStorage.setItem('gb-theme', dark ? 'dark' : 'light') } catch {}
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label="Toggle dark mode"
      title="Toggle dark mode"
      className={cn(
        'press inline-flex items-center justify-center w-9 h-9 rounded-full border border-border text-ink-soft',
        'hover:text-ink hover:bg-kinu/60 transition-colors',
        className,
      )}
    >
      <Moon className="w-4 h-4 dark:hidden" />
      <Sun className="w-4 h-4 hidden dark:block" />
    </button>
  )
}
