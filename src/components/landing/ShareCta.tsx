import Link from 'next/link'
import { cn } from '@/lib/utils/cn'

/**
 * The page's one action, wherever it appears.
 *
 * Signed out, it is the Google sign-in form with an intent attached, so the
 * member lands on the board with the share form already open rather than on a
 * board they then have to figure out. Signed in, it goes straight there.
 * With the board closed there is nothing to post into, so it becomes a plain
 * way in instead of a promise the board would then refuse.
 */
export function ShareCta({
  isAuthed,
  boardOpen,
  label = 'Start a discussion',
  className,
}: {
  isAuthed: boolean
  boardOpen: boolean
  label?: string
  className?: string
}) {
  const classes = cn(
    'press group inline-flex items-center justify-center gap-2 h-11 px-5 rounded-full',
    'bg-ink text-parchment text-[14px] font-medium',
    'hover:bg-ink/85 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-saffron transition-colors',
    className,
  )
  const arrow = (
    <span aria-hidden className="transition-transform group-hover:translate-x-0.5">→</span>
  )

  if (!boardOpen) {
    return (
      <Link href={isAuthed ? '/board' : '/login'} className={classes}>
        {isAuthed ? 'Open the board' : 'Sign in'} {arrow}
      </Link>
    )
  }

  if (isAuthed) {
    return (
      <Link href="/board?share=1" className={classes}>
        {label} {arrow}
      </Link>
    )
  }

  return (
    <form action="/api/auth/login" method="POST">
      <input type="hidden" name="intent" value="share" />
      <button type="submit" className={classes}>
        {label} {arrow}
      </button>
    </form>
  )
}
