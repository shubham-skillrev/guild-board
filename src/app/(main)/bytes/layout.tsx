import { redirect } from 'next/navigation'
import { HIDE_BYTES } from '@/lib/experiment'

/**
 * The switch for hiding Bytes without deleting it. The crons keep publishing
 * either way, so turning it back on brings back a current digest.
 */
export default function BytesLayout({ children }: { children: React.ReactNode }) {
  if (HIDE_BYTES) redirect('/board')
  return children
}
