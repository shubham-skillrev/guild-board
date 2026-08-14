'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import type { Cycle } from '@/types'

interface CycleListCardsProps {
  cycles: Cycle[]
}

const STATUS_TONES: Record<Cycle['status'], React.ComponentProps<typeof Badge>['tone']> = {
  upcoming: 'saffron',
  open: 'matcha',
  frozen: 'indigo',
  closed: 'neutral',
}

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(dateStr))
}

export function CycleListCards({ cycles }: CycleListCardsProps) {
  const router = useRouter()
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const handleDelete = async (cycleId: string, label: string) => {
    const confirmed = window.confirm(`Delete ${label}? This cannot be undone.`)
    if (!confirmed) return

    setDeletingId(cycleId)
    try {
      const res = await fetch('/api/admin/cycles', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycle_id: cycleId }),
      })

      if (res.ok) {
        router.refresh()
      }
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-2">
      {cycles.map(cycle => (
        <div
          key={cycle.id}
          className="flex items-center justify-between gap-3 p-(--pad-card) bg-paper/50 rounded-(--radius-card) border border-border hover:border-border-strong transition-colors"
        >
          <div className="min-w-0">
            <p className="text-footnote font-semibold text-ink">{cycle.label}</p>
            <p className="text-[12px] text-ink-soft mt-0.5">
              {cycle.opens_at
                ? `Opened ${formatDate(cycle.opens_at)}`
                : 'Not opened yet'}
              {cycle.meeting_at && ` · Meeting ${formatDate(cycle.meeting_at)}`}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Badge tone={STATUS_TONES[cycle.status]}>{cycle.status}</Badge>
            <Button
              size="sm"
              variant="danger"
              onClick={() => handleDelete(cycle.id, cycle.label)}
              disabled={deletingId === cycle.id}
            >
              {deletingId === cycle.id ? 'Deleting…' : 'Delete'}
            </Button>
          </div>
        </div>
      ))}
    </div>
  )
}