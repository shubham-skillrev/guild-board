'use client'

import { useState } from 'react'
import { DownloadSimple } from '@phosphor-icons/react/dist/ssr'
import { Icon } from '@/components/ui/Icon'
import { cn } from '@/lib/utils/cn'

/**
 * The post-meeting report image (GET /api/admin/meeting/report/image): a
 * small preview and "Download report image", to post in the guild's Slack
 * channel. Admin only (the route 404s for anyone else). Hide it while a
 * rehearsal runs: the route refuses then (409), and the preview says so.
 */
export function ReportButton({ cycleId, label, className }: { cycleId: string; label?: string; className?: string }) {
  // Fetched once per mount: the numbers are final after End.
  const [stamp] = useState(() => Date.now())
  const [failed, setFailed] = useState(false)
  const src = `/api/admin/meeting/report/image?cycle_id=${encodeURIComponent(cycleId)}&t=${stamp}`
  const file = `guild-meeting-${(label ?? 'report').toLowerCase().replace(/[^a-z0-9]+/g, '-')}.png`
  return (
    <div className={cn('flex items-end gap-4', className)}>
      <a href={src} target="_blank" rel="noreferrer" aria-label="Open the report image" className="press block shrink-0 overflow-hidden rounded-(--radius-card) border border-border bg-sumi">
        {failed ? (
          <span className="flex h-[150px] w-[120px] items-center justify-center p-3 text-center text-footnote text-ink-muted">No report yet</span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- a generated PNG from our own route, not a static asset
          <img src={src} alt="The meeting report: people joined and every activity's results" width={120} height={150} className="block h-[150px] w-[120px] object-cover object-top" onError={() => setFailed(true)} />
        )}
      </a>
      <a
        href={src}
        download={file}
        className="press inline-flex h-8 items-center gap-1.5 rounded-full bg-kinu/70 px-3.5 text-footnote font-medium text-ink-soft hover:bg-kinu hover:text-ink"
      >
        <Icon icon={DownloadSimple} size="sm" />
        Download report image
      </a>
    </div>
  )
}
