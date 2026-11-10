import { CardSkeleton } from '@/components/ui/Section'

/**
 * Every page under (main) is dynamic. Without a loading boundary Next skips
 * prefetching them and a click waits, with nothing on screen, for the whole
 * server render. With one, the layout and this skeleton are prefetched, so a
 * click swaps the page at once and the content streams in behind it.
 */
export default function Loading() {
  return (
    <div className="px-(--pad-page-x) py-8 w-full max-w-(--measure-wide) mx-auto">
      <div className="mb-8 space-y-2.5" aria-hidden>
        <div className="h-7 w-48 rounded bg-fill-strong animate-pulse-soft" />
        <div className="h-3.5 w-32 rounded bg-fill animate-pulse-soft" />
      </div>
      <CardSkeleton />
    </div>
  )
}
