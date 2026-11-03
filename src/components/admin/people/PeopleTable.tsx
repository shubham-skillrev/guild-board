'use client'

import { useMemo, useState } from 'react'
import { cn } from '@/lib/utils/cn'
import { LEVELS, levelLabel, type Person } from '@/lib/people'

type SortKey = 'name' | 'level' | 'lastSeen' | 'daysActive30' | 'namedPosts' | 'namedComments' | 'votes'

const LEVEL_RANK = Object.fromEntries(LEVELS.map((l, i) => [l.value, LEVELS.length - i]))

/** Everyone as rows, sortable, with a box to select for nudging. */
export function PeopleTable({
  people,
  selected,
  onToggle,
}: {
  people: Person[]
  selected: Set<string>
  onToggle: (key: string) => void
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'level', dir: -1 })

  const rows = useMemo(() => {
    const val = (p: Person): string | number => {
      switch (sort.key) {
        case 'name': return p.name.toLowerCase()
        case 'level': return p.member ? LEVEL_RANK[p.level] : -1
        case 'lastSeen': return p.lastSeen ?? ''
        default: return p[sort.key]
      }
    }
    return [...people].sort((a, b) => (val(a) > val(b) ? 1 : val(a) < val(b) ? -1 : 0) * sort.dir)
  }, [people, sort])

  const head = (key: SortKey, label: string, className?: string) => (
    <th scope="col" className={cn('px-3 py-2 font-medium', className)} aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        className="hover:text-ink"
        onClick={() => setSort(s => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : -1 }))}
      >
        {label}{sort.key === key ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}
      </button>
    </th>
  )

  return (
    <div className="overflow-x-auto rounded-(--radius-card) border border-border bg-paper">
      <table className="w-full text-footnote">
        <thead>
          <tr className="border-b border-border text-left text-ink-muted">
            <th scope="col" className="w-8 px-3 py-2"><span className="sr-only">Select</span></th>
            {head('name', 'Name')}
            <th scope="col" className="px-3 py-2 font-medium">Team</th>
            {head('level', 'Level')}
            {head('lastSeen', 'Last here')}
            {head('daysActive30', 'Days (30d)', 'text-right')}
            {head('namedPosts', 'Posts*', 'text-right')}
            {head('namedComments', 'Comments*', 'text-right')}
            {head('votes', 'Votes', 'text-right')}
            <th scope="col" className="px-3 py-2 font-medium">App · Push</th>
            <th scope="col" className="px-3 py-2 font-medium">Survey</th>
            <th scope="col" className="px-3 py-2 font-medium">Nudge</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map(p => (
            <tr key={p.key} className={cn(selected.has(p.key) && 'bg-kinu/40')}>
              <td className="px-3 py-2">
                <input type="checkbox" checked={selected.has(p.key)} onChange={() => onToggle(p.key)} aria-label={`Select ${p.name}`} className="size-4 accent-ink" />
              </td>
              <td className="px-3 py-2">
                <span className="text-ink">{p.name}</span>
                {p.username && <span className="block text-meta text-ink-muted">@{p.username}</span>}
              </td>
              <td className="px-3 py-2 text-ink-soft">{p.teamName ?? '—'}</td>
              <td className="px-3 py-2 text-ink-soft">{p.member ? levelLabel(p.level) : 'No account'}</td>
              <td className="px-3 py-2 text-ink-soft tabular">{p.lastSeen ?? '—'}</td>
              <td className="px-3 py-2 text-right tabular">{p.daysActive30}</td>
              <td className="px-3 py-2 text-right tabular">{p.namedPosts}</td>
              <td className="px-3 py-2 text-right tabular">{p.namedComments}</td>
              <td className="px-3 py-2 text-right tabular">{p.votes}</td>
              <td className="px-3 py-2 text-ink-soft">{p.app ? 'App' : '—'} · {p.push ? 'On' : '—'}</td>
              <td className="px-3 py-2 text-ink-soft">{p.survey ? (p.survey.demo === 'yes' ? 'Could demo' : 'Answered') : '—'}</td>
              <td className="px-3 py-2 text-ink-soft">{p.nudgesOff ? 'Opted out' : p.canNudge ? 'Can' : 'Wait 14d'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-border px-3 py-2 text-meta text-ink-muted">
        * Under their own name only, last 60 days. Anonymous posts and comments never appear per person.
      </p>
    </div>
  )
}
