import { Broadcast, CalendarBlank, ChatsCircle, MicrophoneStage } from '@phosphor-icons/react/dist/ssr'
import { Icon } from '@/components/ui/Icon'
import { formatLabel } from '@/lib/showtell'
import type { GuildSnapshot } from '@/lib/guild/snapshot'

function when(iso: string | null): string {
  if (!iso) return 'Date coming soon'
  return new Date(iso).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit' })
}

const HOUR = [
  { icon: Broadcast, title: 'Radar', text: 'Three things that shipped this month, a minute each.' },
  { icon: MicrophoneStage, title: 'Show & Tell', text: 'Two people show something: a tool, a script, a bug that ate their week.' },
  { icon: ChatsCircle, title: 'The top topic', text: 'Whatever the board voted for. Devs, DevOps, QA, PMs, everyone weighs in.' },
]

/**
 * What a newcomer needs to see before deciding to join: when we meet, what
 * the hour looks like, and what's already on the board. Shared by /join and
 * the welcome after the survey.
 */
export function GuildWelcome({ snapshot }: { snapshot: GuildSnapshot }) {
  const m = snapshot.meeting
  return (
    <div className="space-y-6">
      {m && (
        <div className="flex items-start gap-3 rounded-(--radius-card) border border-border bg-paper px-4 py-3.5">
          <Icon icon={CalendarBlank} size="sm" className="mt-0.5 shrink-0 text-ink-muted" />
          <div className="min-w-0">
            <p className="text-footnote font-medium text-ink">Next meeting: {when(m.at)} IST</p>
            <p className="text-meta text-ink-muted">
              {m.label}{m.theme ? ` · this month's theme: ${m.theme}` : ''} · one hour, on a call
            </p>
          </div>
        </div>
      )}

      <div>
        <p className="mb-2 text-footnote font-medium text-ink">What the hour looks like</p>
        <ol className="grid gap-2 sm:grid-cols-3">
          {HOUR.map(h => (
            <li key={h.title} className="rounded-(--radius-card) border border-border bg-paper/60 p-3.5">
              <Icon icon={h.icon} size="sm" className="text-ink-muted" />
              <p className="mt-2 text-footnote font-medium text-ink">{h.title}</p>
              <p className="mt-0.5 text-meta leading-snug text-ink-muted">{h.text}</p>
            </li>
          ))}
        </ol>
      </div>

      {(snapshot.topics.length > 0 || snapshot.spotlight || snapshot.demo) && (
        <div className="grid gap-4 sm:grid-cols-2">
          {snapshot.topics.length > 0 && (
            <div className="min-w-0">
              <p className="mb-2 text-footnote font-medium text-ink">On the board right now</p>
              <ul className="space-y-1.5">
                {snapshot.topics.map(t => (
                  <li key={t} className="truncate rounded-(--radius-control) bg-kinu/40 px-3 py-2 text-footnote text-ink-soft">{t}</li>
                ))}
              </ul>
            </div>
          )}
          {(snapshot.spotlight || snapshot.demo) && (
            <div className="min-w-0">
              <p className="mb-2 text-footnote font-medium text-ink">Showing something this month</p>
              <ul className="space-y-1.5">
                {[snapshot.spotlight, snapshot.demo].filter(Boolean).map(s => (
                  <li key={s!.id} className="rounded-(--radius-control) bg-kinu/40 px-3 py-2 text-footnote text-ink-soft">
                    <span className="text-ink">@{s!.username}</span> · {s!.title || formatLabel(s!.format)}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
