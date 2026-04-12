import { cn } from '@/lib/utils/cn'
import type { Cycle } from '@/types'
import type { CyclePhase } from '@/hooks/useCurrentCycle'

const BANNER_STYLES: Record<CyclePhase, string> = {
  upcoming: 'bg-kinu text-ink-soft border-b border-border',
  open: 'bg-matcha-light text-matcha border-b border-matcha/20',
  frozen: 'bg-indigo-light text-indigo-jp border-b border-indigo-jp/20',
  closed: 'bg-kinu text-cha border-b border-border',
  spark_active: 'bg-wisteria-light text-wisteria border-b border-wisteria/20',
}

const PHASE_LABEL: Record<CyclePhase, string> = {
  upcoming: 'Coming up',
  open: 'Open for ideas & votes',
  frozen: 'Locked — meeting incoming',
  closed: 'Cycle complete',
  spark_active: 'Spark window — recognize great work',
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

  const daysToFreeze = phase === 'open' ? daysUntil(cycle.freezes_at) : null
  const daysToMeeting = phase === 'frozen' ? daysUntil(cycle.meeting_at) : null
  const daysToSparkClose = phase === 'spark_active' ? daysUntil(cycle.spark_closes_at) : null

  return (
    <div className={cn('px-4 py-2 text-[13px] flex items-center justify-between', BANNER_STYLES[phase])}>
      <div className="flex items-center gap-2">
        <span className="font-semibold">{cycle.label}</span>
        <span className="opacity-50">·</span>
        <span>{PHASE_LABEL[phase]}</span>
      </div>
      <div className="text-[11px] opacity-75">
        {daysToFreeze !== null && `Locks in ${daysToFreeze}d`}
        {daysToMeeting !== null && `Meeting in ${daysToMeeting}d`}
        {daysToSparkClose !== null && `Sparks close in ${daysToSparkClose}d`}
      </div>
    </div>
  )
}
