/**
 * The post-meeting report (docs/06-meeting-mode.md, "After the meeting"):
 * one anonymous summary of a month's meeting, for the image posted to the
 * guild's Slack channel (app/api/admin/meeting/report/image) and its JSON.
 *
 * Counts only. The input carries participant rows and responses, but the
 * output never has a name, a guest name, a user id or a participant id:
 * people are counted (members vs guests), answers are aggregated by
 * ./activity.ts aggregate(), the same numbers the shared screen showed.
 *
 * Pure, imports by path only: runs under `node --test`.
 */

import { aggregate, optionsOf, type ActivityRow, type ResponseRow } from './activity.ts'
import { bossProblem } from './boss.ts'

/** How many cloud words the report lists. */
export const REPORT_WORDS = 8
export const NO_ANSWERS = 'No answers'

export interface ReportSlide {
  id: string
  slide?: string
  section?: string
  title?: string
}

export interface ReportInput {
  label: string
  meetingAt: string | null
  agenda: ReportSlide[]
  /** meeting_participants rows: only whether each is a member is read. */
  participants: { user_id: string | null }[]
  activities: ActivityRow[]
  responses: (ResponseRow & { activity_id: string })[]
}

export interface ReportBar {
  label: string
  n: number
  /** Whole-number share of the answers, 0-100. */
  pct: number
}

export interface ReportActivity {
  kind: 'poll' | 'cloud' | 'boss'
  /** The section it ran in ("Radar", "Warm-up"…). */
  section: string
  prompt: string
  /** People who answered at all (boss: tried). */
  answered: number
  /** Nobody answered (or it never opened): the image says NO_ANSWERS. */
  empty: boolean
  /** poll: every option with its votes, in option order. */
  options?: ReportBar[]
  /** cloud: the most typed words, at most REPORT_WORDS. */
  words?: { word: string; n: number }[]
  /** boss: people whose latest run passed everything, of those who tried. */
  boss?: { problem: string; trying: number; passed: number; pct: number }
}

export interface MeetingReport {
  month: string
  /** The meeting's date, as the guild reads it (IST). */
  date: string | null
  /** The agenda in short: its section titles, in order. */
  sections: string[]
  people: { members: number; guests: number; total: number }
  activities: ReportActivity[]
  /** The "Rate today's meeting" poll, pulled out (null if there was none). */
  rating: ReportActivity | null
}

const pct = (n: number, of: number) => (of > 0 ? Math.round((n / of) * 100) : 0)

/** The rating poll: its slide id says so, or its prompt asks how the meeting was. */
export function isRatingPoll(a: Pick<ActivityRow, 'kind' | 'segment_id' | 'prompt'>): boolean {
  return a.kind === 'poll' && (/^rate(-|$)/.test(a.segment_id) || /\b(rate|how was) (today|the meeting|this meeting)/i.test(a.prompt))
}

export function meetingDate(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (!Number.isFinite(d.getTime())) return null
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' }).format(d)
}

function sectionsOf(agenda: ReportSlide[]): string[] {
  const out: string[] = []
  let lastKey: string | null = null
  for (const s of agenda) {
    const key = s.section ?? `#${s.id}`
    if (key === lastKey) continue
    lastKey = key
    const title = (s.section ?? s.title ?? '').trim()
    if (title) out.push(title)
  }
  return out
}

export function meetingReport(input: ReportInput): MeetingReport {
  const members = input.participants.filter(p => !!p.user_id).length
  const guests = input.participants.length - members
  const order = new Map(input.agenda.map((s, i) => [s.id, i]))
  const sectionFor = (id: string) => input.agenda.find(s => s.id === id)?.section ?? ''

  const byActivity = new Map<string, ResponseRow[]>()
  for (const r of input.responses) {
    const list = byActivity.get(r.activity_id) ?? []
    list.push({ participant_id: r.participant_id, slot: r.slot, value: r.value })
    byActivity.set(r.activity_id, list)
  }

  const rows = [...input.activities]
    // Only what's on the agenda, in agenda order (a stray seeded row isn't the meeting).
    .filter(a => order.has(a.segment_id))
    .sort((a, b) => (order.get(a.segment_id) ?? 0) - (order.get(b.segment_id) ?? 0))

  const all: { row: ActivityRow; out: ReportActivity }[] = rows.map(row => {
    const agg = aggregate(row, byActivity.get(row.id) ?? [])
    const out: ReportActivity = {
      kind: row.kind,
      section: sectionFor(row.segment_id),
      prompt: row.prompt,
      answered: agg.answered,
      empty: agg.answered === 0,
    }
    if (row.kind === 'poll') {
      const counts = agg.counts ?? optionsOf(row.options).map(() => 0)
      out.options = optionsOf(row.options).map((label, i) => ({ label, n: counts[i] ?? 0, pct: pct(counts[i] ?? 0, agg.total) }))
    } else if (row.kind === 'cloud') {
      out.words = (agg.words ?? []).slice(0, REPORT_WORDS).map(w => ({ word: w.word, n: w.n }))
    } else {
      const t = agg.tally ?? {}
      out.boss = { problem: bossProblem(row.config)?.title ?? row.prompt, trying: t.trying ?? 0, passed: t.passed ?? 0, pct: t.pct ?? 0 }
    }
    return { row, out }
  })

  const rated = all.find(x => isRatingPoll(x.row))
  return {
    month: input.label,
    date: meetingDate(input.meetingAt),
    sections: sectionsOf(input.agenda),
    people: { members, guests, total: members + guests },
    activities: all.filter(x => x !== rated).map(x => x.out),
    rating: rated?.out ?? null,
  }
}
