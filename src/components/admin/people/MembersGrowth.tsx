'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Check, Minus } from '@phosphor-icons/react/dist/ssr'
import { SectionHeader } from '@/components/ui/Section'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { UserAvatar } from '@/components/ui/UserAvatar'
import { Figure, Trend } from '@/components/admin/pulse/Trend'
import { cn } from '@/lib/utils/cn'
import type { Bucket, Grain, Growth, Source } from '@/lib/guild/growth'

/* Sources in fixed categorical order (validated slots 1-3, light and dark);
   "before tracking" is neutral, not a series colour. */
const SOURCES: { key: Source; label: string; swatch: string }[] = [
  { key: 'survey', label: 'From the survey', swatch: 'bg-[#2a78d6] dark:bg-[#3987e5]' },
  { key: 'join', label: 'From an invite link', swatch: 'bg-[#eb6834] dark:bg-[#d95926]' },
  { key: 'direct', label: 'Direct', swatch: 'bg-[#1baf7a] dark:bg-[#199e70]' },
  { key: 'unknown', label: 'Before tracking', swatch: 'bg-border-strong' },
]

function pct(n: number, of: number): string {
  return of ? `${Math.round((n / of) * 100)}%` : '—'
}

/**
 * Who's joining, how, and how far they get. Counts, plus the last month's
 * joiners by name (named activity only, like everywhere else in People).
 */
export function MembersGrowth({ growth, companySize, readOnly = false }: { growth: Growth; companySize: number; readOnly?: boolean }) {
  const [grain, setGrain] = useState<Grain>('week')
  const buckets = growth.series[grain]
  const back = growth.funnel[growth.funnel.length - 1]

  return (
    <section aria-labelledby="people-growth" className="space-y-8">
      <SectionHeader id="people-growth" title="Members" hint="Who’s joining, how, and how far they get" />

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <Figure label="Members" value={growth.members} sub={`${pct(growth.members, companySize)} of ~${companySize} at SkillRev`} />
        <Figure label="Joined, last 30 days" value={growth.joined30} />
        <Figure label="Came back in week two" value={back.of ? pct(back.n, back.of) : '—'} sub={back.of ? `${back.n} of ${back.of} who joined 2+ weeks ago` : 'nobody old enough yet'} />
        <Figure label="Not in yet" value={Math.max(0, companySize - growth.members)} sub="people at SkillRev" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <SignupChart buckets={buckets} grain={grain} onGrain={setGrain} />
        <Trend
          title="Total members"
          unit="members"
          span={grain === 'day' ? 'last 30 days' : grain === 'week' ? 'last 12 weeks' : 'last 12 months'}
          points={buckets.map(b => ({ label: b.label, value: b.running }))}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Funnel steps={growth.funnel} />
        <Roles roles={growth.roles} noRole={growth.noRole} members={growth.members} />
      </div>

      <Recent recent={growth.recent} readOnly={readOnly} />
    </section>
  )
}

function SignupChart({ buckets, grain, onGrain }: { buckets: Bucket[]; grain: Grain; onGrain: (g: Grain) => void }) {
  const max = Math.max(1, ...buckets.map(b => b.total))
  const totals = Object.fromEntries(SOURCES.map(s => [s.key, buckets.reduce((n, b) => n + b.bySource[s.key], 0)])) as Record<Source, number>
  const every = Math.ceil(buckets.length / 6)
  return (
    <figure className="elev-1 rounded-(--radius-card) p-4">
      <figcaption className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-footnote font-medium text-ink">Sign-ups</span>
        <SegmentedControl label="Group by" value={grain} onChange={onGrain} options={[{ key: 'day', label: 'Day' }, { key: 'week', label: 'Week' }, { key: 'month', label: 'Month' }]} />
      </figcaption>

      <div className="mt-4 flex h-36 items-end gap-[2px] border-b border-border" role="img" aria-label={`Sign-ups per ${grain}: ${buckets.map(b => `${b.label} ${b.total}`).join(', ')}`}>
        {buckets.map(b => (
          <div key={b.start} className="group relative flex h-full min-w-0 flex-1 flex-col justify-end" tabIndex={0} aria-label={`${b.label}: ${b.total} joined`}>
            {/* Stack bottom-up, a 2px gap between segments, rounded only at the top. */}
            {[...SOURCES].reverse().filter(s => b.bySource[s.key] > 0).map((s, i, arr) => (
              <div
                key={s.key}
                className={cn(s.swatch, i < arr.length - 1 && 'mb-[2px]', i === 0 && 'rounded-t-[3px]')}
                style={{ height: `${(b.bySource[s.key] / max) * 100}%` }}
              />
            ))}
            <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 hidden -translate-x-1/2 whitespace-nowrap rounded-(--radius-control) bg-ink px-2 py-1.5 text-caption text-parchment shadow-sm group-hover:block group-focus:block">
              <strong>{b.total}</strong> joined · {b.label}
              {SOURCES.filter(s => b.bySource[s.key]).map(s => (
                <span key={s.key} className="block opacity-80">{s.label}: {b.bySource[s.key]}</span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex gap-[2px] text-[10px] text-ink-muted">
        {buckets.map((b, i) => <span key={b.start} className="min-w-0 flex-1 truncate">{i % every === 0 ? b.label : ''}</span>)}
      </div>

      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-meta text-ink-soft">
        {SOURCES.map(s => (
          <li key={s.key} className="inline-flex items-center gap-1.5">
            <span aria-hidden className={cn('size-2.5 rounded-[2px]', s.swatch)} />
            {s.label} <span className="text-ink tabular">{totals[s.key]}</span>
          </li>
        ))}
      </ul>
    </figure>
  )
}

function Funnel({ steps }: { steps: Growth['funnel'] }) {
  return (
    <figure className="elev-1 rounded-(--radius-card) p-4">
      <figcaption className="text-footnote font-medium text-ink">From joining to taking part</figcaption>
      <p className="text-meta text-ink-muted">Members who joined in the last 90 days</p>
      <ol className="mt-4 space-y-3">
        {steps.map((s, i) => (
          <li key={s.step}>
            <div className="flex items-baseline justify-between gap-3 text-footnote">
              <span className="text-ink-soft">{s.step}</span>
              <span className="tabular"><span className="font-medium text-ink">{s.n}</span><span className="text-ink-muted"> · {pct(s.n, s.of)}</span></span>
            </div>
            <div className="mt-1 h-2 rounded-r-[4px] bg-kinu">
              <div className={cn('h-full rounded-r-[4px]', i === 0 ? 'bg-ink' : 'bg-ink/60')} style={{ width: s.of ? `${(s.n / s.of) * 100}%` : '0%' }} />
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-3 text-meta text-ink-muted">
        “Came back in week two” counts only people who joined at least two weeks ago, and visits are only recorded since
        tracking started (migration 038), so it reads low until members who joined after that reach week two.
      </p>
    </figure>
  )
}

function Roles({ roles, noRole, members }: { roles: Growth['roles']; noRole: number; members: number }) {
  const max = Math.max(1, ...roles.map(r => r.members + r.waiting))
  return (
    <figure className="elev-1 rounded-(--radius-card) p-4">
      <figcaption className="text-footnote font-medium text-ink">Who’s in, by role</figcaption>
      <p className="text-meta text-ink-muted">From the survey: members, and people who answered but haven’t joined</p>
      {roles.length === 0 ? (
        <p className="mt-4 text-footnote text-ink-muted">No survey answers yet.</p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {roles.map(r => (
            <li key={r.role} className="grid grid-cols-[minmax(0,7.5rem)_minmax(0,1fr)_auto] items-center gap-3 text-footnote">
              <span className="truncate text-ink-soft">{r.role}</span>
              <span className="flex h-2.5">
                <span className="h-full bg-ink" style={{ width: `${(r.members / max) * 100}%` }} />
                {r.waiting > 0 && <span className="ml-[2px] h-full rounded-r-[3px] bg-ink/25" style={{ width: `${(r.waiting / max) * 100}%` }} />}
              </span>
              <span className="tabular text-ink">{r.members}<span className="text-ink-muted"> + {r.waiting}</span></span>
            </li>
          ))}
        </ul>
      )}
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-meta text-ink-soft">
        <li className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-[2px] bg-ink" /> Members</li>
        <li className="inline-flex items-center gap-1.5"><span aria-hidden className="size-2.5 rounded-[2px] bg-ink/25" /> Answered, not joined</li>
      </ul>
      {noRole > 0 && <p className="mt-2 text-meta text-ink-muted">{noRole} of {members} members haven’t answered the survey, so their role isn’t known.</p>}
    </figure>
  )
}

const SOURCE_LABEL: Record<Source, string> = { survey: 'Survey', join: 'Invite link', direct: 'Direct', unknown: '—' }

function Recent({ recent, readOnly }: { recent: Growth['recent']; readOnly: boolean }) {
  const mark = (on: boolean, what: string) => (
    <span title={`${what}: ${on ? 'yes' : 'not yet'}`} className={cn('grid size-5 place-items-center rounded-full', on ? 'bg-ink text-parchment' : 'bg-kinu text-ink-muted')}>
      {on ? <Check weight="bold" className="size-3" /> : <Minus className="size-3" />}
      <span className="sr-only">{`${what}: ${on ? 'yes' : 'not yet'}`}</span>
    </span>
  )
  return (
    <div>
      <h3 className="mb-2 text-footnote font-medium text-ink">Joined in the last 30 days <span className="font-normal text-ink-muted">· {recent.length}</span></h3>
      {recent.length === 0 ? (
        <p className="text-footnote text-ink-muted">Nobody new this month.</p>
      ) : (
        <div className="elev-1 overflow-x-auto rounded-(--radius-card)">
          <table className="w-full text-footnote">
            <thead>
              <tr className="border-b border-separator text-left text-ink-muted">
                <th scope="col" className="px-4 py-2 font-medium">Member</th>
                <th scope="col" className="px-3 py-2 font-medium">Joined</th>
                <th scope="col" className="px-3 py-2 font-medium">Role</th>
                <th scope="col" className="px-3 py-2 font-medium">Came from</th>
                <th scope="col" className="px-2 py-2 text-center font-medium">Name</th>
                <th scope="col" className="px-2 py-2 text-center font-medium">Voted</th>
                <th scope="col" className="px-2 py-2 text-center font-medium">Spoke*</th>
                <th scope="col" className="px-2 py-2 text-center font-medium">Alerts</th>
                {!readOnly && <th scope="col" className="px-4 py-2"><span className="sr-only">Nudge</span></th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-separator">
              {recent.map(j => (
                <tr key={j.userId}>
                  <td className="px-4 py-2">
                    <span className="flex items-center gap-2.5">
                      <UserAvatar username={j.username} size={24} />
                      <span className="min-w-0">
                        <span className="block truncate text-ink">{j.name}</span>
                        <span className="block text-meta text-ink-muted">@{j.username}</span>
                      </span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-ink-soft tabular">{new Date(j.joined).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                  <td className="px-3 py-2 text-ink-soft">{j.role ?? '—'}</td>
                  <td className="px-3 py-2 text-ink-soft">{SOURCE_LABEL[j.source]}</td>
                  <td className="px-2 py-2"><span className="flex justify-center">{mark(j.pickedName, 'Picked a username')}</span></td>
                  <td className="px-2 py-2"><span className="flex justify-center">{mark(j.voted, 'Voted')}</span></td>
                  <td className="px-2 py-2"><span className="flex justify-center">{mark(j.spoke, 'Commented or posted')}</span></td>
                  <td className="px-2 py-2"><span className="flex justify-center">{mark(j.push, 'Notifications on')}</span></td>
                  {!readOnly && (
                    <td className="px-4 py-2 text-right">
                      <Link href={`/admin/people?pick=${j.userId}#people-hall`} className="text-meta text-ink-muted underline-offset-2 hover:text-ink hover:underline">Nudge</Link>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-separator px-4 py-2 text-meta text-ink-muted">* Under their own name.</p>
        </div>
      )}
    </div>
  )
}
