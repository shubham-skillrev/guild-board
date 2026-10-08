import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { HIDE_BYTES } from '@/lib/experiment'

// The template repeats the root one: a plain string here would drop it for
// the [id] page underneath.
export const metadata: Metadata = {
  title: { default: 'Bytes', template: '%s \u00b7 GuildBoard' },
}

/**
 * The switch for hiding Bytes without deleting it. The crons keep publishing
 * either way, so turning it back on brings back a current digest.
 */
export default function BytesLayout({ children }: { children: React.ReactNode }) {
  if (HIDE_BYTES) redirect('/board')
  return children
}
