import {
  ATTENDED,
  DEMO,
  JOIN_REASONS,
  MEETING_SLOTS,
  ROLES,
  type Option,
  type Role,
  type SurveyResponse,
} from '@/lib/survey'

/** What a tally needs from an answer: no name, no email. */
export type StatRow = Pick<
  SurveyResponse,
  'role' | 'attended' | 'join_reasons' | 'demo' | 'meeting_slot' | 'verified'
> & { member: boolean }

export interface Bar {
  value: string
  label: string
  n: number
  /** Share of the answers in view, 0..1. */
  share: number
}

export interface SurveyStats {
  total: number
  newVoices: number
  signedIn: number
  couldDemo: number
  questions: { key: string; title: string; note?: string; bars: Bar[] }[]
}

/** One question's totals, largest first, zeroes dropped. */
function tally(options: readonly Option[], values: (string | null)[], total: number): Bar[] {
  const counts = new Map<string, number>()
  for (const v of values) if (v) counts.set(v, (counts.get(v) ?? 0) + 1)
  return options
    .map(o => ({ value: o.value, label: o.label, n: counts.get(o.value) ?? 0, share: 0 }))
    .filter(b => b.n > 0)
    .map(b => ({ ...b, share: total ? b.n / total : 0 }))
    .sort((a, b) => b.n - a.n)
}

/**
 * Totals for the dashboard and its image export. Counts only, so the same
 * numbers can go up at the meeting without anyone's name on them.
 */
export function surveyStats(rows: StatRow[], role: Role | 'all' = 'all'): SurveyStats {
  const view = role === 'all' ? rows : rows.filter(r => r.role === role)
  const total = view.length
  const questions = [
    ...(role === 'all' ? [{ key: 'role', title: 'Who answered', bars: tally(ROLES, view.map(r => r.role), total) }] : []),
    {
      key: 'join',
      title: 'What would make them join',
      note: 'Up to 3 each, so shares add past 100%',
      bars: tally(JOIN_REASONS, view.flatMap(r => r.join_reasons ?? []), total),
    },
    { key: 'demo', title: 'Could show something', bars: tally(DEMO, view.map(r => r.demo), total) },
    { key: 'attended', title: 'Been to a guild meeting', bars: tally(ATTENDED, view.map(r => r.attended), total) },
    { key: 'slot', title: 'Best time for the meeting', bars: tally(MEETING_SLOTS, view.map(r => r.meeting_slot), total) },
  ]
  return {
    total,
    newVoices: view.filter(r => !r.member).length,
    signedIn: view.filter(r => r.verified).length,
    couldDemo: view.filter(r => r.demo === 'yes' || r.demo === 'maybe').length,
    questions,
  }
}

export function pct(share: number): string {
  return `${Math.round(share * 100)}%`
}
