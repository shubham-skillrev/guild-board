import { SectionHeader } from '@/components/ui/Section'
import type { NudgeLogRow } from '@/lib/guild/nudges'

const CHANNEL: Record<string, string> = { push: 'Push + board', inbox: 'Board card', slack_copy: 'Slack (copied)' }

/** What was sent, by whom, and whether it led anywhere within a week. */
export function NudgeLog({ rows }: { rows: NudgeLogRow[] }) {
  const acted = rows.filter(r => r.acted).length
  return (
    <section aria-labelledby="people-log">
      <SectionHeader
        id="people-log"
        title="Notes sent"
        hint={rows.length ? `${acted} of ${rows.length} led somewhere within a week (posted, commented, voted, volunteered or joined)` : 'Nothing sent yet.'}
      />
      {rows.length > 0 && (
        <ul className="divide-y divide-border border-y border-border">
          {rows.map(r => (
            <li key={r.id} className="py-2.5 text-footnote">
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-ink">{r.name}</span>
                <span className="text-meta text-ink-muted">
                  {new Date(r.sentAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} · {CHANNEL[r.channel] ?? r.channel}
                  {r.sentBy ? ` · by @${r.sentBy}` : ''}
                </span>
                <span className={r.acted ? 'ml-auto text-meta text-ink' : 'ml-auto text-meta text-ink-muted'}>{r.acted ? 'Acted' : 'Not yet'}</span>
              </p>
              <p className="mt-0.5 line-clamp-2 text-ink-soft">{r.body}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
