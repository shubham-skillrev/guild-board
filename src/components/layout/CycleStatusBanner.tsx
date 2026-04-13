import { cn } from '@/lib/utils/cn'
import type { Cycle } from '@/types'
import type { CyclePhase } from '@/hooks/useCurrentCycle'

const BANNER_STYLES: Record<CyclePhase, string> = {
  upcoming: 'bg-kinu text-ink-soft border-b border-border',
  open: 'bg-matcha-light text-matcha border-b border-matcha/20',
  discussion: 'bg-indigo-light text-indigo-jp border-b border-indigo-jp/20',
}

const PHASE_LABEL: Record<CyclePhase, string> = {
  upcoming: 'Coming up',
  open: 'Open for ideas & votes',
  discussion: 'Discussion mode - voting is locked',
}

function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)))
}

interface CycleStatusBannerProps {
  cycle: Cycle | null
  phase: CyclePhase
}

export function CycleStatusBanner({ cycle, phase }: CycleStatusBannerProps) {
  if (!cycle) return null

  const daysToMeeting = phase === 'open' ? daysUntil(cycle.meeting_at) : null

  return (
    <div className={cn('px-4 py-2 text-[13px] flex items-center justify-between', BANNER_STYLES[phase])}>
      <div className="flex items-center gap-2">
        <span className="font-semibold">{cycle.label}</span>
        <span className="opacity-50">·</span>
        <span>{PHASE_LABEL[phase]}</span>
      </div>
      <div className="text-[11px] opacity-75">
        {daysToMeeting !== null && `Locks in ${daysToMeeting}d`}
      </div>
    </div>
  )
}
