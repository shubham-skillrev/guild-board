'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/utils/cn'
import type { Cycle } from '@/types'

interface CycleListCardsProps {
  cycles: Cycle[]
}

const STATUS_STYLES: Record<Cycle['status'], string> = {
  upcoming: 'bg-saffron-light text-saffron border-saffron/20',
  open: 'bg-matcha-light text-matcha border-matcha/20',
  frozen: 'bg-indigo-light text-indigo-jp border-indigo-jp/20',
  closed: 'bg-kinu text-cha border-border',
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
          className="flex items-center justify-between gap-3 p-4 bg-paper/50 rounded-xl border border-border hover:border-border-strong transition-colors"
        >
          <div>
            <p className="text-[14px] font-medium text-ink">{cycle.label}</p>
            <p className="text-[12px] text-ink-soft mt-0.5">
              {cycle.opens_at
                ? `Opened ${formatDate(cycle.opens_at)}`
                : 'Not opened yet'}
              {cycle.meeting_at && ` · Meeting ${formatDate(cycle.meeting_at)}`}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className={cn('text-[11px] font-medium px-2 py-1 rounded-full border', STATUS_STYLES[cycle.status])}>
              {cycle.status}
            </span>
            <button
              onClick={() => handleDelete(cycle.id, cycle.label)}
              disabled={deletingId === cycle.id}
              className="px-3 py-1.5 text-[12px] font-medium rounded-lg border border-vermillion/30 bg-vermillion-light text-vermillion hover:bg-vermillion/20 disabled:opacity-50 transition-all"
            >
              {deletingId === cycle.id ? 'Deleting…' : 'Delete'}
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}