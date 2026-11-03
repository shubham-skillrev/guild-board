/** The People tab's shapes, shared by the server and the hall. */

export type ActivityLevel = 'quiet' | 'showing_up' | 'regular' | 'driving'

export const LEVELS: { value: ActivityLevel; label: string }[] = [
  { value: 'driving', label: 'Driving it' },
  { value: 'regular', label: 'Regular' },
  { value: 'showing_up', label: 'Showing up' },
  { value: 'quiet', label: 'Quiet' },
]

export function levelLabel(level: ActivityLevel): string {
  return LEVELS.find(l => l.value === level)?.label ?? 'Quiet'
}

/** One nudge per person per fortnight, whoever sends it. */
export const NUDGE_GAP_DAYS = 14
export const NUDGE_MAX = 500

export interface Person {
  /** user id, or `survey:<email>` for someone without an account. */
  key: string
  userId: string | null
  member: boolean
  name: string
  username: string | null
  email: string
  isAdmin: boolean
  /** Can see the control room read-only (migration 043). */
  isViewer: boolean
  joined: string | null
  /** A blend of everything (ghost activity included), never a count. */
  level: ActivityLevel
  lastSeen: string | null
  daysActive30: number
  /** Seen in the 30-90 days before, not in the last 30. */
  wentQuiet: boolean
  app: boolean
  push: boolean
  /** Named activity only, last 60 days. */
  namedPosts: number
  namedComments: number
  votes: number
  demos: number
  survey: { demo: string | null; demoIdea: string | null; learnNext: string | null; nominated: string | null } | null
  nudgesOff: boolean
  lastNudged: string | null
  canNudge: boolean
}

export const SEGMENTS = [
  { value: 'all', label: 'Everyone' },
  { value: 'quiet', label: 'Went quiet', test: (p: Person) => p.member && p.wentQuiet },
  { value: 'no-account', label: 'Survey, no account', test: (p: Person) => !p.member },
  { value: 'could-demo', label: 'Could show something', test: (p: Person) => p.survey?.demo === 'yes' || p.survey?.demo === 'maybe' },
  { value: 'no-named-posts', label: 'No posts under their name', test: (p: Person) => p.member && p.namedPosts === 0 },
  { value: 'no-survey', label: 'Haven’t answered the survey', test: (p: Person) => p.member && !p.survey },
  { value: 'no-push', label: 'Notifications off', test: (p: Person) => p.member && !p.push },
] as const

export type Segment = (typeof SEGMENTS)[number]['value']

export function inSegment(p: Person, segment: Segment): boolean {
  const s = SEGMENTS.find(x => x.value === segment)
  return !s || !('test' in s) ? true : s.test(p)
}
