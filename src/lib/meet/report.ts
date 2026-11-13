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

import { aggregate, optionsOf, type ActivityKind, type ActivityRow, type ResponseRow } from './activity.ts'
import { bossProblem } from './boss.ts'
import { isStage, STAGE_LABELS, type StageKind } from './bossStages.ts'
import { sharesOf } from './results.ts'

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

/** One Boss Round stage's score: the share of those who answered (write: who ran the tests) that got it right. */
export interface ReportStage {
  kind: StageKind
  label: string
  answered: number
  correct: number
  pct: number
}

export interface ReportActivity {
  kind: ActivityKind
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
  /** predict / fill: how many got it right, of those who answered. */
  quiz?: { correct: number; answered: number; pct: number }
  /** The Boss Round's stages as one card (reportCards): each stage's score, in order. */
  stages?: ReportStage[]
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
  /** The Boss Round's stages (predict, fill, write), in agenda order: % right each. Empty when there was none. */
  stages: ReportStage[]
}

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
      // The same shares as the screen and the phones (lib/meet/results.ts): they add up to 100.
      const labels = optionsOf(row.options)
      const counts = labels.map((_, i) => agg.counts?.[i] ?? 0)
      const pcts = sharesOf(counts)
      out.options = labels.map((label, i) => ({ label, n: counts[i], pct: pcts[i] }))
    } else if (row.kind === 'cloud') {
      out.words = (agg.words ?? []).slice(0, REPORT_WORDS).map(w => ({ word: w.word, n: w.n }))
    } else if (row.kind === 'predict' || row.kind === 'fill') {
      // Graded as the screen's reveal was (aggregate, closed): the report never sees an unclosed answer.
      const closed = row.status === 'closed' ? agg : aggregate({ ...row, status: 'closed' }, byActivity.get(row.id) ?? [])
      const t = closed.tally ?? {}
      out.quiz = { correct: t.correct ?? 0, answered: t.answered ?? 0, pct: t.pct ?? 0 }
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
    stages: stagesOf(all.map(x => x.out)),
  }
}

/** The stages that ran (anyone answered). An old single Boss Round is just "Boss Round". */
function stagesOf(acts: ReportActivity[]): ReportStage[] {
  const out = acts.filter(a => isStage(a.kind) && !a.empty).map(stageOf)
  return out.length === 1 && out[0].kind === 'boss' && !acts.some(a => a.kind === 'predict' || a.kind === 'fill') ? [{ ...out[0], label: 'Boss Round' }] : out
}

function stageOf(a: ReportActivity): ReportStage {
  const kind = a.kind as StageKind
  if (kind === 'boss') return { kind, label: STAGE_LABELS.boss, answered: a.boss?.trying ?? 0, correct: a.boss?.passed ?? 0, pct: a.boss?.pct ?? 0 }
  return { kind, label: STAGE_LABELS[kind], answered: a.quiz?.answered ?? 0, correct: a.quiz?.correct ?? 0, pct: a.quiz?.pct ?? 0 }
}

/**
 * The report image's cards: every activity, except that a Boss Round run in
 * stages (any predict or fill) is one card listing each stage's %, where its
 * first stage was. An old single Boss Round keeps its own card.
 */
export function reportCards(r: Pick<MeetingReport, 'activities'>): ReportActivity[] {
  if (!r.activities.some(a => a.kind === 'predict' || a.kind === 'fill')) return r.activities
  const out: ReportActivity[] = []
  let card: ReportActivity | null = null
  for (const a of r.activities) {
    if (!isStage(a.kind)) {
      out.push(a)
      continue
    }
    if (!card) {
      card = { kind: 'boss', section: a.section || 'Boss Round', prompt: 'Kers’ Boss Round', answered: 0, empty: true, stages: [] }
      out.push(card)
    }
    const st = stageOf(a)
    card.stages!.push(st)
    card.answered = Math.max(card.answered, st.answered)
    if (!a.empty) card.empty = false
  }
  return out
}

/** What the board's month recap shows (components/board/MeetingRecap.tsx): the report, cut down. */
export interface MeetingRecap {
  month: string
  date: string | null
  people: MeetingReport['people']
  /** Up to three: a poll's top answer, a cloud's top words. */
  highlights: ({ kind: 'poll'; prompt: string; top: string; pct: number; answered: number } | { kind: 'cloud'; prompt: string; words: string[]; answered: number })[]
  stages: ReportStage[]
  /** The rating poll's top answer. */
  rating: { top: string; pct: number; answered: number } | null
}

export const RECAP_HIGHLIGHTS = 3

/**
 * The month recap from a report, or null when there's nothing to say (nobody
 * joined and nothing was answered: the meeting didn't really run).
 */
export function meetingRecap(r: MeetingReport): MeetingRecap | null {
  const answered = r.activities.some(a => !a.empty) || (r.rating && !r.rating.empty)
  if (!r.people.total && !answered) return null
  const highlights: MeetingRecap['highlights'] = []
  for (const a of r.activities) {
    if (highlights.length >= RECAP_HIGHLIGHTS || a.empty) continue
    if (a.kind === 'poll' && a.options?.length) {
      const top = [...a.options].sort((x, y) => y.n - x.n)[0]
      if (top.n > 0) highlights.push({ kind: 'poll', prompt: a.prompt, top: top.label, pct: top.pct, answered: a.answered })
    } else if (a.kind === 'cloud' && a.words?.length) {
      highlights.push({ kind: 'cloud', prompt: a.prompt, words: a.words.slice(0, 3).map(w => w.word), answered: a.answered })
    }
  }
  const rt = r.rating && !r.rating.empty && r.rating.options?.length ? [...r.rating.options].sort((x, y) => y.n - x.n)[0] : null
  return {
    month: r.month,
    date: r.date,
    people: r.people,
    highlights,
    stages: r.stages,
    rating: rt && rt.n > 0 ? { top: rt.label, pct: rt.pct, answered: r.rating!.answered } : null,
  }
}
