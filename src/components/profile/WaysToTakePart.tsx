'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AnimatePresence } from 'framer-motion'
import { Check } from '@phosphor-icons/react/dist/ssr'
import { Button } from '@/components/ui/Button'
import { PushToggleButton } from '@/components/pwa/PushOptIn'
import { VolunteerModal } from '@/components/showtell/ShowAndTell'
import { AddLink } from '@/components/radar/RadarSection'
import { formatLabel } from '@/lib/showtell'
import { cn } from '@/lib/utils/cn'
import type { Involvement } from '@/lib/guild/nextSteps'

const DEMO_STATUS: Record<string, string> = {
  proposed: 'In the queue',
  invited: 'Invited: answer on the board',
  confirmed: 'Booked',
  done: 'Done',
}

/**
 * Every way to take part in the guild, from the member's own profile: their
 * Show & Tell so far, then one-tap actions that tick themselves off once done.
 */
export function WaysToTakePart({ involvement, meeting, idea }: { involvement: Involvement; meeting: string | null; idea: string | null }) {
  const router = useRouter()
  const [modal, setModal] = useState<'volunteer' | 'radar' | null>(null)
  const i = involvement

  const rows: { key: string; title: string; hint: string; done: boolean; action?: React.ReactNode }[] = [
    {
      key: 'volunteer',
      title: 'Show something at a meeting',
      hint: idea ? `You said you could show “${idea}”.` : 'Ten minutes: a tool, a script, a bug that ate your week. No slides.',
      done: i.offered,
      action: meeting ? <Button size="sm" variant="secondary" onClick={() => setModal('volunteer')}>Volunteer</Button> : null,
    },
    {
      key: 'radar',
      title: 'Put a link on this month’s Radar',
      hint: 'The top three open the meeting.',
      done: i.radarThisMonth,
      action: meeting ? <Button size="sm" variant="secondary" onClick={() => setModal('radar')}>Add a link</Button> : null,
    },
    {
      key: 'nominate',
      title: 'Nominate someone for the Spotlight',
      hint: 'Someone whose work more people should see. Nominations live in the survey.',
      done: i.nominated,
      action: <Link href="/survey" className="press inline-flex h-6.5 items-center rounded-(--radius-control) bg-kinu/70 px-2.5 text-[12px] text-ink-soft hover:bg-kinu hover:text-ink pointer-coarse:h-10">Nominate</Link>,
    },
    {
      key: 'survey',
      title: 'Answer the guild survey',
      hint: 'Two minutes on what would make the meeting worth your hour.',
      done: i.answeredSurvey,
      action: <Link href="/survey" className="press inline-flex h-6.5 items-center rounded-(--radius-control) bg-kinu/70 px-2.5 text-[12px] text-ink-soft hover:bg-kinu hover:text-ink pointer-coarse:h-10">Answer</Link>,
    },
    {
      key: 'push',
      title: 'Turn on notifications',
      hint: 'Replies, the meeting reminder, and when you get a spark.',
      done: i.pushOn,
      action: <PushToggleButton />,
    },
  ]
  const done = rows.filter(r => r.done).length

  return (
    <section aria-labelledby="take-part" className="mb-8 rounded-[20px] border border-border bg-paper p-5 sm:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="take-part" className="text-[15px] font-semibold text-ink">Ways to take part</h2>
        <span className="text-meta text-ink-muted tabular">{done} of {rows.length}</span>
      </div>

      {i.demos.length > 0 && (
        <div className="mt-4 rounded-(--radius-card) bg-kinu/40 p-3.5">
          <p className="text-meta text-ink-muted">Your Show & Tell</p>
          <ul className="mt-1.5 space-y-1">
            {i.demos.map(d => (
              <li key={d.id} className="flex flex-wrap items-baseline gap-x-2 text-footnote">
                <span className="text-ink">{d.title || (d.kind === 'spotlight' ? 'Spotlight' : formatLabel('demo'))}</span>
                <span className="text-meta text-ink-muted">
                  {d.kind === 'spotlight' ? 'Spotlight' : 'Demo'}{d.cycle ? ` · ${d.cycle}` : ''} · {DEMO_STATUS[d.status] ?? d.status}
                </span>
                {d.status === 'invited' && <Link href="/board" className="text-meta text-ink underline underline-offset-2">Answer</Link>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <ol className="mt-4 divide-y divide-separator border-y border-separator">
        {rows.map(r => (
          <li key={r.key} className="flex items-center gap-3 py-3">
            <span aria-hidden className={cn('grid size-5 shrink-0 place-items-center rounded-full border', r.done ? 'border-ink bg-ink text-parchment' : 'border-border-strong')}>
              {r.done && <Check weight="bold" className="size-3" />}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn('text-footnote', r.done ? 'text-ink-muted' : 'text-ink')}>
                {r.title}
                <span className="sr-only">{r.done ? ' (done)' : ''}</span>
              </p>
              {!r.done && <p className="text-meta text-ink-muted">{r.hint}</p>}
            </div>
            {!r.done && r.action && <span className="shrink-0">{r.action}</span>}
          </li>
        ))}
      </ol>

      <AnimatePresence>
        {modal === 'volunteer' && meeting && (
          <VolunteerModal meeting={meeting} initialTitle={idea ?? ''} onClose={() => setModal(null)} onDone={() => router.refresh()} />
        )}
        {modal === 'radar' && <AddLink onClose={() => setModal(null)} onDone={() => router.refresh()} />}
      </AnimatePresence>
    </section>
  )
}
