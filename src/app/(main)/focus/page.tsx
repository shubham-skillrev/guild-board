import type { Metadata } from 'next'
import { FocusRoom } from '@/components/focus/FocusRoom'

export const metadata: Metadata = { title: 'Focus' }

/** Work in blocks with GuildBot; he leads the breaks. Runs in the browser only. */
export default function FocusPage() {
  return (
    <div className="px-5 md:px-10 py-8 w-full max-w-5xl mx-auto">
      <FocusRoom />
    </div>
  )
}
