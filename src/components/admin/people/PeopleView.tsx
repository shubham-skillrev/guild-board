'use client'

import { useMemo, useState } from 'react'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'
import { GuildHall } from '@/components/admin/people/GuildHall'
import { PeopleTable } from '@/components/admin/people/PeopleTable'
import { NudgePanel } from '@/components/admin/people/NudgePanel'
import { SEGMENTS, inSegment, type Person, type Segment } from '@/lib/people'

/**
 * The People tab's working area: pick a group, see them as the hall or a
 * table, pick people, and nudge them from the panel on the right.
 */
export function PeopleView({
  people,
  teams,
  initialSegment,
}: {
  people: Person[]
  teams: { id: string; name: string }[]
  initialSegment: Segment
}) {
  const [view, setView] = useState<'hall' | 'table'>('hall')
  const [segment, setSegment] = useState<Segment>(initialSegment)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const shown = useMemo(() => people.filter(p => inSegment(p, segment)), [people, segment])
  const picked = useMemo(() => people.filter(p => selected.has(p.key)), [people, selected])
  const reachableInSegment = shown.filter(p => p.canNudge)

  const toggle = (key: string) =>
    setSelected(s => {
      const next = new Set(s)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <div className="grid grid-cols-1 gap-x-8 gap-y-8 lg:grid-cols-[minmax(0,1fr)_360px] items-start">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div role="radiogroup" aria-label="Group" className="flex flex-wrap gap-1.5">
            {SEGMENTS.map(s => {
              const n = people.filter(p => inSegment(p, s.value)).length
              const on = segment === s.value
              return (
                <button
                  key={s.value}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => setSegment(s.value)}
                  className={cn(
                    'press-sm inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-footnote transition-colors',
                    on ? 'border-ink bg-ink text-parchment' : 'border-border bg-paper text-ink-soft hover:text-ink',
                  )}
                >
                  {s.label}
                  <span className={cn('tabular', on ? 'text-parchment/70' : 'text-ink-muted')}>{n}</span>
                </button>
              )
            })}
          </div>
          <SegmentedControl
            className="ml-auto"
            label="View"
            value={view}
            onChange={setView}
            options={[{ key: 'hall', label: 'Hall' }, { key: 'table', label: 'Table' }]}
          />
        </div>

        {segment !== 'all' && reachableInSegment.length > 0 && (
          <Button size="sm" variant="secondary" onClick={() => setSelected(new Set(reachableInSegment.slice(0, 25).map(p => p.key)))}>
            Pick {Math.min(25, reachableInSegment.length)} who can be nudged
          </Button>
        )}

        {view === 'hall'
          ? <GuildHall people={shown} selected={selected} onToggle={toggle} />
          : <PeopleTable people={shown} selected={selected} onToggle={toggle} />}
      </div>

      <aside className="min-w-0 lg:sticky lg:top-20">
        <NudgePanel
          picked={picked}
          segment={segment}
          teams={teams}
          onClear={() => setSelected(new Set())}
          onRemove={toggle}
        />
      </aside>
    </div>
  )
}
