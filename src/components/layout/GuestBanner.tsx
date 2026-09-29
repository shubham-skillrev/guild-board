import Link from 'next/link'
import { Eye } from '@phosphor-icons/react/dist/ssr'
import { exitGuestMode } from '@/app/actions/guest'

/**
 * Says, on every member page, that nothing here will stick. The proxy refuses
 * guest writes either way; this is so a guest learns it before clicking,
 * not from an error toast after.
 */
export function GuestBanner() {
  return (
    <div className="border-b border-border bg-saffron-light/60">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1.5 px-5 md:px-10 py-2 w-full max-w-7xl mx-auto text-[13px]">
        <p className="flex items-center gap-2 text-ink-soft">
          <Eye className="w-4 h-4 shrink-0 text-saffron" />
          <span>
            <span className="font-medium text-ink">Guest mode.</span> Look around; everything is read-only.
          </span>
        </p>
        <div className="flex items-center gap-3">
          <Link href="/login" className="font-medium text-ink underline underline-offset-2 hover:text-saffron transition-colors">
            Sign in to take part
          </Link>
          <form action={exitGuestMode}>
            <button type="submit" className="text-cha hover:text-ink transition-colors">
              Exit
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
