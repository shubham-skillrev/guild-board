import { SectionHeader } from '@/components/ui/Section'
import { cn } from '@/lib/utils/cn'

export interface EngagementRow {
  id: string
  title: string
  /** The handle shown on the board: a ghost handle for anonymous posts. */
  by: string
  votes: number
  comments: number
  signals: number
}

/**
 * How each topic is doing this month, at a glance: votes as ranked bars (the
 * leader dark, the rest context), with comments and one-tap signals beside.
 * Authors appear exactly as on the board, ghost handles included.
 */
export function TopicEngagement({ rows }: { rows: EngagementRow[] }) {
  if (!rows.length) return null
  const max = Math.max(1, ...rows.map(r => r.votes))
  return (
    <section aria-labelledby="topics-engagement" className="mb-(--gap-section)">
      <SectionHeader id="topics-engagement" title="How the board is doing" hint="Votes, comments and signals per topic this month" />
      <div className="elev-1 overflow-x-auto rounded-(--radius-card)">
        <table className="w-full text-footnote">
          <thead>
            <tr className="border-b border-separator text-left text-ink-muted">
              <th scope="col" className="px-4 py-2 font-medium">Topic</th>
              <th scope="col" className="px-4 py-2 font-medium w-[34%]">Votes</th>
              <th scope="col" className="px-4 py-2 font-medium text-right">Comments</th>
              <th scope="col" className="px-4 py-2 font-medium text-right">Signals</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-separator">
            {rows.map(r => (
              <tr key={r.id}>
                <td className="px-4 py-2.5">
                  <span className="block truncate max-w-[22rem] text-ink">{r.title}</span>
                  <span className="text-meta text-ink-muted">{r.by}</span>
                </td>
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-2">
                    <span className="h-2 flex-1">
                      <span
                        className={cn('block h-full rounded-r-[4px]', r.votes === max ? 'bg-ink' : 'bg-ink/25')}
                        style={{ width: `${Math.max((r.votes / max) * 100, r.votes ? 4 : 0)}%` }}
                      />
                    </span>
                    <span className="w-6 text-right tabular text-ink">{r.votes}</span>
                  </span>
                </td>
                <td className="px-4 py-2.5 text-right tabular text-ink-soft">{r.comments}</td>
                <td className="px-4 py-2.5 text-right tabular text-ink-soft">{r.signals}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}
