import { isAllowedEmailDomain } from '@/lib/utils/email'

/**
 * The guild survey at /survey: what would make people at SkillRev come to
 * the monthly meeting, and who would show something.
 *
 * One definition shared by the form, the API and the admin panel, so a
 * question's options are never spelled two ways. The values are also the
 * CHECK constraints in migration 037: change both together.
 */

/** Which run of the survey this is. A new key starts a fresh set of answers. */
export const SURVEY_KEY = 'pulse-2026-11'

export interface Option<T extends string = string> {
  value: T
  label: string
}

export const ROLES = [
  { value: 'dev', label: 'Developer' },
  { value: 'devops', label: 'DevOps' },
  { value: 'qa', label: 'QA' },
  { value: 'pm', label: 'Product manager' },
  { value: 'scrum_master', label: 'Scrum master' },
  { value: 'design', label: 'Design' },
  { value: 'other', label: 'Other' },
] as const satisfies readonly Option[]

export const ATTENDED = [
  { value: 'regularly', label: 'Regularly' },
  { value: 'once_or_twice', label: 'Once or twice' },
  { value: 'never', label: 'Never' },
] as const satisfies readonly Option[]

export const JOIN_REASONS = [
  { value: 'ai_for_work', label: 'AI for my work' },
  { value: 'live_demos', label: 'Live demos' },
  { value: 'process', label: 'Fixing team process' },
  { value: 'career_comms', label: 'Career & communication' },
  { value: 'problems_solved', label: 'Real problems solved' },
  { value: 'hear_builds', label: 'Hearing what others build' },
  { value: 'other', label: 'Something else' },
] as const satisfies readonly Option[]

export const DEMO = [
  { value: 'yes', label: 'Yes, I have an idea' },
  { value: 'maybe', label: 'Maybe, with some help' },
  { value: 'not_now', label: 'Not right now' },
] as const satisfies readonly Option[]

export const MEETING_SLOTS = [
  { value: 'morning', label: 'Morning' },
  { value: 'lunch', label: 'Around lunch' },
  { value: 'afternoon', label: 'Afternoon' },
  { value: 'evening', label: 'Evening' },
] as const satisfies readonly Option[]

export type Role = (typeof ROLES)[number]['value']
export type Attended = (typeof ATTENDED)[number]['value']
export type JoinReason = (typeof JOIN_REASONS)[number]['value']
export type Demo = (typeof DEMO)[number]['value']
export type MeetingSlot = (typeof MEETING_SLOTS)[number]['value']

export const MAX_JOIN_REASONS = 3

export const LIMITS = {
  name: 80,
  email: 254,
  join_other: 120,
  learn_next: 200,
  demo_idea: 200,
  nominee_name: 80,
  nominee_why: 200,
} as const

export interface SurveyAnswers {
  name: string
  email: string
  role: Role | null
  attended: Attended | null
  join_reasons: JoinReason[]
  join_other: string
  learn_next: string
  demo: Demo | null
  demo_idea: string
  nominee_name: string
  nominee_why: string
  meeting_slot: MeetingSlot | null
}

export const EMPTY_ANSWERS: SurveyAnswers = {
  name: '',
  email: '',
  role: null,
  attended: null,
  join_reasons: [],
  join_other: '',
  learn_next: '',
  demo: null,
  demo_idea: '',
  nominee_name: '',
  nominee_why: '',
  meeting_slot: null,
}

/** A stored answer, as the admin panel reads it. */
export interface SurveyResponse extends Omit<SurveyAnswers, 'role'> {
  id: number
  role: Role
  verified: boolean
  updated_at: string
}

export function labelOf(options: readonly Option[], value: string | null | undefined): string {
  return options.find(o => o.value === value)?.label ?? ''
}

function pick<T extends string>(options: readonly Option<T>[], value: unknown): T | null {
  return options.find(o => o.value === value)?.value ?? null
}

function text(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

/**
 * Turns whatever the browser sent into answers the table accepts, or says
 * what is missing. Unknown option values are dropped rather than rejected:
 * a stale tab should still be able to submit.
 */
export function sanitizeAnswers(
  raw: unknown,
): { ok: true; answers: SurveyAnswers } | { ok: false; error: string } {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>

  const reasons = Array.isArray(r.join_reasons) ? r.join_reasons : []
  const join_reasons = [...new Set(reasons.map(v => pick(JOIN_REASONS, v)).filter((v): v is JoinReason => !!v))]
    .slice(0, MAX_JOIN_REASONS)
  const demo = pick(DEMO, r.demo)

  const answers: SurveyAnswers = {
    name: text(r.name, LIMITS.name),
    email: text(r.email, LIMITS.email).toLowerCase(),
    role: pick(ROLES, r.role),
    attended: pick(ATTENDED, r.attended),
    join_reasons,
    join_other: join_reasons.includes('other') ? text(r.join_other, LIMITS.join_other) : '',
    learn_next: text(r.learn_next, LIMITS.learn_next),
    demo,
    demo_idea: demo === 'yes' || demo === 'maybe' ? text(r.demo_idea, LIMITS.demo_idea) : '',
    nominee_name: text(r.nominee_name, LIMITS.nominee_name),
    nominee_why: text(r.nominee_why, LIMITS.nominee_why),
    meeting_slot: pick(MEETING_SLOTS, r.meeting_slot),
  }

  if (!answers.name) return { ok: false, error: 'Add your name.' }
  if (!/^[^\s@]+@[^\s@]+$/.test(answers.email) || !isAllowedEmailDomain(answers.email)) {
    return { ok: false, error: 'Use your @skillrev.dev email.' }
  }
  if (!answers.role) return { ok: false, error: 'Pick your role.' }
  if (!answers.nominee_name) answers.nominee_why = ''

  return { ok: true, answers }
}
