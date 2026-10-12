'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Badge } from '@/components/ui/Badge'
import { OverflowMenu } from '@/components/ui/OverflowMenu'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import type { Cycle } from '@/types'

const STATUS: Record<Cycle['status'], { label: string; tone: React.ComponentProps<typeof Badge>['tone'] }> = {
  upcoming: { label: 'Upcoming', tone: 'saffron' },
  open: { label: 'Open', tone: 'matcha' },
  frozen: { label: 'Frozen', tone: 'indigo' },
  closed: { label: 'Closed', tone: 'neutral' },
}

function formatDate(dateStr: string) {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(new Date(dateStr))
}

/**
 * Every cycle, one compact row each. Delete lives in the row's ⋯ menu and asks
 * for the month's name to be typed: it removes every topic, vote and comment
 * in that month, so it should never be a red word sitting on each row.
 */
export function CycleListCards({ cycles }: { cycles: Cycle[] }) {
  const router = useRouter()
  const [target, setTarget] = useState<Cycle | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState('')

  const remove = async (cycle: Cycle) => {
    setPending(true)
    setError('')
    try {
      const res = await fetch('/api/admin/cycles', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cycle_id: cycle.id }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error ?? 'Could not delete that cycle.')
        return
      }
      setTarget(null)
      router.refresh()
    } finally {
      setPending(false)
    }
  }

  return (
    <>
      {error && <p role="alert" className="mb-2 text-footnote text-vermillion">{error}</p>}
      <ul className="bg-paper border border-border rounded-(--radius-card) divide-y divide-border">
        {cycles.map(cycle => {
          const status = STATUS[cycle.status]
          return (
            <li key={cycle.id} className="flex items-center gap-3 pl-(--pad-card) pr-2 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-footnote text-ink truncate">{cycle.label}</p>
                <p className="text-caption text-cha mt-0.5 truncate">
                  {cycle.meeting_at ? `Meeting ${formatDate(cycle.meeting_at)}` : cycle.opens_at ? `Opened ${formatDate(cycle.opens_at)}` : 'Not opened yet'}
                </p>
              </div>
              <Badge tone={status.tone}>{status.label}</Badge>
              <OverflowMenu
                label={`More actions for ${cycle.label}`}
                items={[{ label: `Delete ${cycle.label}…`, danger: true, onSelect: () => setTarget(cycle) }]}
              />
            </li>
          )
        })}
      </ul>

      {target && (
        <ConfirmDialog
          title={`Delete ${target.label}?`}
          body="This deletes the cycle and every topic, vote and comment in it. It cannot be undone."
          confirmText={target.label}
          actionLabel="Delete cycle"
          pending={pending}
          onConfirm={() => remove(target)}
          onClose={() => setTarget(null)}
        />
      )}
    </>
  )
}
