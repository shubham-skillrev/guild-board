'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useToast } from '@/hooks/useToast'
import { ChartBar, DownloadSimple, FilePdf, Image as ImageIcon } from '@phosphor-icons/react/dist/ssr'
import { Button } from '@/components/ui/Button'
import { EmptyState } from '@/components/ui/Section'
import { cn } from '@/lib/utils/cn'
import { DEMO, JOIN_REASONS, ROLES, SURVEY_KEY, labelOf, type Role } from '@/lib/survey'
import { pct, surveyStats, type Bar } from '@/lib/surveyStats'
import type { SurveyRow, SurveyState } from '@/lib/surveyResults'
import { KersBriefing, type BriefingView } from '@/components/admin/pulse/KersBriefing'

/**
 * Survey results, as one report.
 *
 * Read top to bottom the way the meeting will: one headline number, the
 * totals per question, then the people to follow up with. The role filter
 * scopes everything below it, so the numbers always agree with each other.
 *
 * Exports: the image is totals only (made on the server, safe to put on a
 * slide or in Slack); "Save as PDF" prints this page, and "Hide names" takes
 * every name and email out of it first.
 */
export function SurveyDashboard({
  rows,
  state,
  generatedAt,
  briefing,
  readOnly = false,
}: {
  rows: SurveyRow[]
  state: SurveyState
  generatedAt: string
  /** Kers' read of the results (the page reads the daily cache). */
  briefing: BriefingView
  /** A viewer: no open/close switch, no CSV or image exports. */
  readOnly?: boolean
}) {
  const [role, setRole] = useState<Role | 'all'>('all')
  const [names, setNames] = useState(true)

  const view = useMemo(() => (role === 'all' ? rows : rows.filter(r => r.role === role)), [rows, role])
  const stats = useMemo(() => surveyStats(rows, role), [rows, role])
  const rolesPresent = ROLES.filter(o => rows.some(r => r.role === o.value))

  const demos = view.filter(r => r.demo === 'yes' || r.demo === 'maybe')
  const nominations = view.filter(r => r.nominee_name)
  const wishes = view.filter(r => r.learn_next)
  const otherReasons = view.filter(r => r.join_other)

  const savePdf = () => {
    // Print in the light theme whatever the screen is in: dark pages waste ink
    // and most printers drop the backgrounds anyway.
    const root = document.documentElement
    const wasDark = root.classList.contains('dark')
    if (wasDark) {
      root.classList.remove('dark')
      window.addEventListener('afterprint', () => root.classList.add('dark'), { once: true })
    }
    window.print()
  }

  const roleLabel = role === 'all' ? 'Everyone' : labelOf(ROLES, role)
  const imageHref = `/api/admin/survey/image${role === 'all' ? '' : `?role=${role}`}`

  return (
    <div id="survey-report">
      {/* ─── Header + controls ─── */}
      <header className="mb-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="eyebrow">Guild survey · {SURVEY_KEY}</p>
            <h1 className="mt-2 text-title-1 text-label">Survey results</h1>
            <p className="mt-1.5 text-callout text-label-2">
              {roleLabel} · {formatStamp(generatedAt)}
              <span className="print:hidden">
                {' · '}
                <a href="/survey" target="_blank" className="underline decoration-border-strong underline-offset-2 hover:text-ink">
                  guildboard.skillrev.in/survey
                </a>
              </span>
            </p>
            {!readOnly && <SurveySwitch state={state} />}
          </div>
          {rows.length > 0 && (
            <div className="print:hidden flex flex-wrap items-center gap-2">
              {!readOnly && <a href={imageHref} download className={EXPORT_BTN}>
                <ImageIcon className="w-4 h-4" aria-hidden />
                Image
              </a>}
              <Button variant="secondary" icon={FilePdf} onClick={savePdf}>
                Save as PDF
              </Button>
              {!readOnly && <a href="/api/admin/survey" className={EXPORT_BTN}>
                <DownloadSimple className="w-4 h-4" aria-hidden />
                CSV
              </a>}
            </div>
          )}
        </div>
      </header>

      <KersBriefing scope="survey" initial={briefing} readOnly={readOnly} className="mb-10 break-inside-avoid" />

      {rows.length === 0 ? (
        <EmptyState
          icon={ChartBar}
          title="No answers yet"
          body="Share guildboard.skillrev.in/survey in Slack. Answers show up here as they come in."
        />
      ) : (
        <>
          {/* ─── Filters: one row, scoping everything below ─── */}
          <div className="print:hidden mb-8 flex flex-wrap items-center gap-x-6 gap-y-3">
            <div role="radiogroup" aria-label="Show answers from" className="flex flex-wrap gap-1.5">
              {[{ value: 'all' as const, label: 'Everyone' }, ...rolesPresent].map(o => (
                <FilterPill key={o.value} name="role" checked={role === o.value} onChange={() => setRole(o.value)}>
                  {o.label}
                </FilterPill>
              ))}
            </div>
            <label className="ml-auto inline-flex items-center gap-2 text-footnote text-ink-soft cursor-pointer select-none">
              <input
                type="checkbox"
                checked={!names}
                onChange={e => setNames(!e.target.checked)}
                className="size-4 accent-ink"
              />
              Hide names
            </label>
          </div>

          {/* ─── Headline: the count, then what people actually said ─── */}
          <section aria-label="Headline" className="mb-10 grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,2.2fr)] break-inside-avoid">
            <div className="flex flex-col justify-between rounded-[20px] bg-ink px-6 py-5 text-parchment">
              <p className="text-footnote text-parchment/70">Answers{role === 'all' ? '' : ` from ${roleLabel.toLowerCase()}`}</p>
              <p className="mt-2 text-[72px] leading-none font-semibold tracking-[-0.05em]">{stats.total}</p>
              <p className="mt-3 text-footnote text-parchment/70">
                {stats.newVoices} without an account · {stats.signedIn} signed in
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Verdict label="Why they’d come" bar={topOf(stats, 'join')} total={stats.total} />
              <Verdict label="Best time" bar={topOf(stats, 'slot')} total={stats.total} />
              <div className="rounded-[20px] border border-border bg-paper px-5 py-4">
                <p className="text-meta text-ink-muted">Could show something</p>
                <p className="mt-2 text-[34px] leading-none font-semibold tracking-tight text-ink">{stats.couldDemo}</p>
                <p className="mt-2 text-meta text-ink-muted">{stats.total ? pct(stats.couldDemo / stats.total) : '0%'} said yes or maybe: that’s the demo queue</p>
              </div>
            </div>
          </section>

          {/* ─── Per question ─── */}
          {stats.total === 0 ? (
            <p className="mb-10 text-footnote text-ink-muted">No answers from {roleLabel.toLowerCase()} yet.</p>
          ) : (
            <section aria-label="Answers per question" className="mb-12 grid gap-4 md:grid-cols-2 print:grid-cols-1">
              {stats.questions.map(q => (
                <article key={q.key} className="elev-1 rounded-(--radius-card) p-5 break-inside-avoid">
                  <h2 className="text-[15px] font-semibold text-ink">{q.title}</h2>
                  {q.note && <p className="mt-0.5 text-caption text-ink-muted">{q.note}</p>}
                  {q.bars.length ? (
                    <BarList bars={q.bars} total={stats.total} />
                  ) : (
                    <p className="mt-4 text-footnote text-ink-muted">Nobody answered this one.</p>
                  )}
                </article>
              ))}
            </section>
          )}

          {/* ─── Follow-ups ─── */}
          <div className="grid gap-x-10 gap-y-10 md:grid-cols-2">
            <List
              title="Could show something"
              count={demos.length}
              empty="Nobody yet."
              items={demos.map(r => ({
                key: r.id,
                lead: names ? r.name : labelOf(ROLES, r.role),
                meta: names ? `${labelOf(ROLES, r.role)} · ${labelOf(DEMO, r.demo)}` : labelOf(DEMO, r.demo),
                body: r.demo_idea,
              }))}
            />
            <List
              title="Spotlight nominations"
              count={nominations.length}
              empty="No nominations yet."
              hidden={!names}
              items={nominations.map(r => ({
                key: r.id,
                lead: r.nominee_name,
                meta: `from ${r.name}`,
                body: r.nominee_why,
              }))}
            />
            <List
              title="Want to learn"
              count={wishes.length}
              empty="Nothing yet."
              items={wishes.map(r => ({ key: r.id, lead: labelOf(ROLES, r.role), body: r.learn_next }))}
            />
            {otherReasons.length > 0 && (
              <List
                title={`"${labelOf(JOIN_REASONS, 'other')}"`}
                count={otherReasons.length}
                empty=""
                items={otherReasons.map(r => ({ key: r.id, lead: labelOf(ROLES, r.role), body: r.join_other }))}
              />
            )}
          </div>

          {/* ─── Everyone (the table view) ─── */}
          {names && (
            <section aria-labelledby="survey-everyone" className="mt-12 break-before-page">
              <h2 id="survey-everyone" className="mb-3 text-[15px] font-semibold text-ink">
                Everyone who answered <span className="font-normal text-ink-muted">· {view.length}</span>
              </h2>
              <div className="overflow-x-auto rounded-(--radius-card) border border-border bg-paper">
                <table className="w-full text-footnote">
                  <thead>
                    <tr className="border-b border-border text-left text-ink-muted">
                      <th className="px-3 py-2 font-medium">Name</th>
                      <th className="px-3 py-2 font-medium">Email</th>
                      <th className="px-3 py-2 font-medium">Role</th>
                      <th className="px-3 py-2 font-medium">Account</th>
                      <th className="px-3 py-2 font-medium">Answered</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {view.map(r => (
                      <tr key={r.id} className="break-inside-avoid">
                        <td className="px-3 py-2 text-ink">{r.name}</td>
                        <td className="px-3 py-2 text-ink-soft">{r.email}</td>
                        <td className="px-3 py-2 text-ink-soft">{labelOf(ROLES, r.role)}</td>
                        <td className="px-3 py-2 text-ink-soft">
                          {r.member ? 'Member' : 'None yet'}
                          {!r.verified && <span className="text-ink-muted"> · typed email</span>}
                        </td>
                        <td className="px-3 py-2 text-ink-muted tabular">{formatDay(r.updated_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}

/* ─── Pieces ─────────────────────────────────────────────── */

/**
 * Taking answers or not, and an optional close date. Closed means no board
 * card and /survey says the results go up at the meeting.
 */
function SurveySwitch({ state }: { state: SurveyState }) {
  const router = useRouter()
  const toast = useToast()
  const [on, setOn] = useState(state.switchedOn)
  const [closesOn, setClosesOn] = useState(state.closesAt ? toDateInput(state.closesAt) : '')
  const [saving, setSaving] = useState(false)

  const save = async (nextOn: boolean, nextDate: string) => {
    setSaving(true)
    try {
      const res = await fetch('/api/admin/survey', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        // A date closes at the end of that day in India.
        body: JSON.stringify({ open: nextOn, closes_at: nextDate ? `${nextDate}T23:59:59+05:30` : null }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error ?? 'Could not save')
      setOn(nextOn)
      setClosesOn(nextDate)
      toast(nextOn ? 'Survey is taking answers' : 'Survey closed', 'success')
      router.refresh()
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not save', 'error')
    } finally {
      setSaving(false)
    }
  }

  const pastClose = on && !state.open
  return (
    <div className="print:hidden mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-footnote">
      <label className="inline-flex items-center gap-2.5 cursor-pointer select-none">
        <button
          type="button"
          role="switch"
          aria-checked={on}
          disabled={saving}
          onClick={() => save(!on, closesOn)}
          className={cn('relative w-8 h-4.5 rounded-full transition-colors', on ? 'bg-ink' : 'bg-border-strong')}
        >
          <span className={cn('absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-paper transition-transform', on && 'translate-x-3.5')} />
          <span className="sr-only">Taking answers</span>
        </button>
        <span className="text-ink">{pastClose ? 'Closed (past its date)' : on ? 'Taking answers' : 'Closed'}</span>
      </label>
      <label className="inline-flex items-center gap-2 text-ink-muted">
        Closes on
        <input
          type="date"
          value={closesOn}
          disabled={saving}
          onChange={e => save(on, e.target.value)}
          className="h-8 rounded-(--radius-control) border border-border bg-paper px-2 text-footnote text-ink"
        />
      </label>
      {closesOn && (
        <button type="button" disabled={saving} onClick={() => save(on, '')} className="text-ink-muted hover:text-ink">
          No close date
        </button>
      )}
    </div>
  )
}

/** ISO instant to the yyyy-mm-dd it falls on in India. */
function toDateInput(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
}

const EXPORT_BTN =
  'press inline-flex items-center gap-1.5 h-8 px-3 rounded-(--radius-control) bg-kinu/70 text-footnote text-ink-soft hover:bg-kinu hover:text-ink transition-colors pointer-coarse:h-11 pointer-coarse:px-4'

function topOf(stats: ReturnType<typeof surveyStats>, key: string): Bar | null {
  return stats.questions.find(q => q.key === key)?.bars[0] ?? null
}

/** The winning answer to one question, said as a sentence. */
function Verdict({ label, bar, total }: { label: string; bar: Bar | null; total: number }) {
  return (
    <div className="rounded-[20px] border border-border bg-paper px-5 py-4">
      <p className="text-meta text-ink-muted">{label}</p>
      {bar ? (
        <>
          <p className="mt-2 text-[19px] leading-snug font-semibold tracking-[-0.01em] text-ink">{bar.label}</p>
          <p className="mt-2 text-meta text-ink-muted">{bar.n} of {total} · {pct(bar.share)}</p>
        </>
      ) : (
        <p className="mt-2 text-footnote text-ink-muted">No answers yet</p>
      )}
    </div>
  )
}

/**
 * Ranked horizontal bars, one hue, largest first. Count and share sit at the
 * tip; hovering or focusing a row repeats them as a sentence for the bars
 * whose label is truncated.
 */
function BarList({ bars, total }: { bars: Bar[]; total: number }) {
  const max = Math.max(...bars.map(b => b.n))
  return (
    <ul className="mt-4 space-y-2.5">
      {bars.map(b => (
        <li
          key={b.value}
          tabIndex={0}
          aria-label={`${b.label}: ${b.n} of ${total} answers, ${pct(b.share)}`}
          className="group relative grid grid-cols-[minmax(0,11rem)_minmax(0,1fr)_4.5rem] items-center gap-3 rounded-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
        >
          <span className="truncate text-footnote text-ink-soft" title={b.label}>{b.label}</span>
          {/* Scaled to the biggest bar, so the leader fills the track. */}
          <span className="h-2.5">
            <span
              className={cn(
                'block h-full rounded-r-[4px] transition-colors group-hover:bg-ink group-focus-visible:bg-ink',
                // The leader carries the colour; the rest are context.
                b.n === max ? 'bg-ink' : 'bg-ink/25',
              )}
              style={{ width: `${Math.max((b.n / max) * 100, 2)}%` }}
            />
          </span>
          <span className="text-right text-footnote tabular">
            <span className="text-ink font-medium">{b.n}</span>
            <span className="text-ink-muted"> · {pct(b.share)}</span>
          </span>
          <span
            role="presentation"
            className="pointer-events-none absolute left-[11.75rem] -top-8 z-10 hidden whitespace-nowrap rounded-(--radius-control) bg-ink px-2 py-1 text-caption text-parchment shadow-sm group-hover:block group-focus-visible:block print:hidden!"
          >
            <strong className="font-semibold">{b.n}</strong> of {total} · {b.label}
          </span>
        </li>
      ))}
    </ul>
  )
}

function List({
  title,
  count,
  empty,
  hidden,
  items,
}: {
  title: string
  count: number
  empty: string
  /** Names are off: say so, rather than showing an empty list. */
  hidden?: boolean
  items: { key: number; lead: string; meta?: string; body?: string }[]
}) {
  return (
    <section className="break-inside-avoid">
      <h2 className="mb-3 text-[15px] font-semibold text-ink">
        {title} <span className="font-normal text-ink-muted">· {count}</span>
      </h2>
      {hidden ? (
        <p className="text-footnote text-ink-muted">Hidden while names are off.</p>
      ) : items.length === 0 ? (
        <p className="text-footnote text-ink-muted">{empty}</p>
      ) : (
        <ul className="divide-y divide-border border-y border-border">
          {items.map(i => (
            <li key={i.key} className="py-2.5 break-inside-avoid">
              <p className="text-footnote">
                <span className="font-medium text-ink">{i.lead}</span>
                {i.meta && <span className="text-ink-muted"> · {i.meta}</span>}
              </p>
              {i.body && <p className="mt-0.5 text-footnote leading-snug text-ink-soft">{i.body}</p>}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function FilterPill({
  name,
  checked,
  onChange,
  children,
}: {
  name: string
  checked: boolean
  onChange: () => void
  children: React.ReactNode
}) {
  return (
    <label
      className={cn(
        'press-sm inline-flex items-center h-8 px-3 rounded-full border text-footnote cursor-pointer select-none transition-colors',
        'pointer-coarse:h-10 pointer-coarse:px-4',
        'has-checked:bg-ink has-checked:border-ink has-checked:text-parchment',
        'not-has-checked:border-border not-has-checked:text-ink-soft not-has-checked:hover:text-ink not-has-checked:hover:border-border-strong',
        'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ink',
      )}
    >
      <input type="radio" name={name} className="sr-only" checked={checked} onChange={onChange} />
      {children}
    </label>
  )
}

function formatStamp(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

function formatDay(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}
