/**
 * Fake data for the meeting-mode mock (/meet/mock, dev only): the first-run
 * agenda from docs/06-meeting-mode.md with Kers' prep, its activities, a room
 * of ~20 or ~60 people, and the phone's own states. Pure: everything is
 * built from the URL's knobs and the clock, so the presenter and the phone
 * (two iframes in "both") show the same numbers.
 */

import { BLOCKED_MESSAGE, type MeetView, type Mine, type PublicActivity, type RoomState } from '@/lib/meet/activity'
import { BOSS_MS, timedOut, type CaseResult } from '@/lib/meet/boss'
import type { MeetingState, Segment } from '@/lib/meeting'
import type { PresenterPost } from '@/lib/guild/meetingPrep'
import type { PhoneDemo } from '@/components/meet/PhoneActivity'

export const CYCLE = 'mock-cycle'
const ME = 'mock-admin'
const OTHER = 'mock-other-admin'
const iso = (ms: number) => new Date(ms).toISOString()
const prep = (opener: string, points: string[]) => ({ opener, points, by: 'kers' as const, at: '2026-11-12T08:00:00.000Z' })

export const AGENDA: Segment[] = [
  {
    id: 'seg-warmup',
    kind: 'warmup',
    title: 'Warm-up',
    detail: 'Kers opens the room. One word each, before anything serious.',
    minutes: 2,
    prep: prep('Phones out. One word for your week. I’ll pretend not to judge.', [
      'Zero stakes: this is to check everyone can join and tap.',
      'Read the two biggest words out loud and move on.',
    ]),
  },
  {
    id: 'seg-radar',
    kind: 'radar',
    title: 'Radar: eMudhra intermediate CA compromise · KV-cache exposure in the GLM-5.3 Worker',
    detail: 'Two stories about trusting someone else’s infrastructure: a CA we chain to, and a hosted model leaking cached prompts across tenants.',
    minutes: 5,
    topicIds: ['post-emudhra', 'post-kvcache'],
    prep: prep('Both of these are about trust. Who here has pasted company code into a chatbot this week?', [
      'eMudhra: an intermediate CA was misused to issue certs; check what in our stack chains to it.',
      'GLM-5.3 Worker: cached KV blocks were readable across tenants for ~36 hours.',
      'Ask the room which of the two would actually change how they work.',
    ]),
  },
  {
    id: 'seg-showtell',
    kind: 'showtell',
    title: 'Show & Tell: Spotlight + Demo',
    detail: 'This month’s Spotlight, then a 7-minute demo of the new deploy previews.',
    minutes: 15,
    prep: prep('Eyes on the presenter. Phones can rest for fifteen minutes.', [
      'Spotlight first: keep it to 6 minutes, questions after.',
      'Demo: ask what broke while building it, not just what works.',
    ]),
  },
  {
    id: 'seg-topic',
    kind: 'topic',
    title: 'AI Bubble Bust',
    detail: 'AI technology vs AI as a business: is the money running out, or just moving?',
    minutes: 18,
    topicIds: ['post-bubble'],
    prep: prep('Pick a side before anyone talks you out of it.', [
      'Separate the tech (still getting better) from the business (burning cash).',
      'The board post’s top comment: “the dot-com crash didn’t kill the internet.”',
      'If “bursts” wins, ask what in our own roadmap assumes it won’t.',
    ]),
  },
  {
    id: 'seg-clinic',
    kind: 'clinic',
    title: 'Problem clinic',
    detail: 'The biggest words are the clinic’s agenda. Two problems from the board to start.',
    minutes: 8,
    topicIds: ['post-flaky', 'post-review'],
    prep: prep('One word: what’s slowing you down? The biggest one gets solved first.', [
      'Start with whatever is biggest in the cloud, not the board posts.',
      'Flaky e2e tests have three upvotes and no owner yet.',
    ]),
  },
  {
    id: 'seg-boss',
    kind: 'boss',
    title: 'Kers’ Boss Round',
    detail: 'Problem #1: sum of the even numbers. Eight minutes, on your own device.',
    minutes: 8,
    prep: prep('Eight minutes, one function, your own device. Kers is keeping score.', [
      'Code runs on their device; only pass or fail comes back.',
      'Read the verdict out at time, then move to the wrap.',
    ]),
  },
  {
    id: 'seg-wrap',
    kind: 'wrap',
    title: 'Wrap: decisions, owners, next month',
    detail: 'What we decided, who owns it, and what goes on next month’s board.',
    minutes: 4,
    prep: prep('Three decisions, three owners, then everyone can go.', [
      'Read back the decisions from the notes; name an owner for each.',
      'Next meeting: second Thursday, same time.',
    ]),
  },
]

export const POSTS: Record<string, PresenterPost> = {
  'post-emudhra': {
    id: 'post-emudhra',
    title: 'eMudhra’s intermediate CA was compromised. Do we chain to it anywhere?',
    description: 'Mis-issued certs for a handful of Indian bank domains. Browsers are distrusting the intermediate next week. Worth checking our partner integrations.',
    voteCount: 9,
    commentCount: 4,
  },
  'post-kvcache': {
    id: 'post-kvcache',
    title: 'KV-cache exposure in the GLM-5.3 Worker',
    description: 'Prompt prefixes were shared across tenants through the cache for about a day and a half. Anyone using the hosted endpoint for code review?',
    voteCount: 7,
    commentCount: 6,
  },
  'post-bubble': {
    id: 'post-bubble',
    title: 'Is the AI bubble about to burst?',
    description: 'Capex is at record highs and revenue isn’t. But the models keep getting better. Is this 2000 all over again, or is “bubble” the wrong word?',
    voteCount: 14,
    commentCount: 11,
  },
  'post-flaky': { id: 'post-flaky', title: 'Our e2e suite fails one run in five', description: 'Mostly timing. Retries hide it, nobody owns it.', voteCount: 3, commentCount: 2 },
  'post-review': { id: 'post-review', title: 'PRs wait two days for review', description: 'Small PRs too. Is it the rota or the size?', voteCount: 5, commentCount: 3 },
}

interface ActivitySpec {
  kind: PublicActivity['kind']
  prompt: string
  options?: string[]
  /** Poll: how the room splits at the end. */
  shares?: number[]
  /** Cloud: words and how many of 20 people typed each. */
  words?: [string, number][]
  config?: Record<string, unknown>
}

const WEEK_WORDS: [string, number][] = [
  ['hectic', 7], ['busy', 5], ['deadline', 4], ['thak gaya', 4], ['chill', 3], ['jugaad', 3], ['sprint', 3],
  ['on-call', 2], ['productive', 2], ['meh', 2], ['chaotic', 2], ['mast', 2], ['release', 2], ['caffeine', 2],
  ['kal dekhenge', 1], ['sorted', 1], ['refactor', 1], ['learning', 1], ['tired', 1], ['jhakaas', 1],
  ['slow', 1], ['vibe coding', 1], ['standups', 1], ['bug bash', 1], ['ekdum fresh', 1], ['node.js', 1],
]
const BLOCKER_WORDS: [string, number][] = [
  ['flaky tests', 6], ['code review', 5], ['meetings', 4], ['scope creep', 3], ['context switching', 3], ['ci', 3],
  ['estimates', 2], ['tech debt', 2], ['env setup', 2], ['access', 2], ['approvals', 2], ['bandwidth nahi', 2],
  ['legacy', 1], ['kubernetes', 1], ['jira', 1], ['dependencies', 1], ['prod bugs', 1], ['clarity', 1],
  ['merge conflicts', 1], ['infra', 1], ['hiring', 1], ['deadlines', 1], ['sab urgent hai', 1], ['docs', 1], ['c++', 1],
]

export const ACTIVITIES: Record<string, ActivitySpec> = {
  'seg-warmup': { kind: 'cloud', prompt: 'One word for your week so far', words: WEEK_WORDS },
  'seg-radar': {
    kind: 'poll',
    prompt: 'Would you send production code to a hosted AI model?',
    options: ['Yes, freely', 'Only with an enterprise contract', 'Only self-hosted', 'Never'],
    shares: [0.14, 0.43, 0.31, 0.12],
  },
  'seg-topic': {
    kind: 'poll',
    prompt: 'AI by 2028?',
    options: ['💥 Bursts', '📉 Slow deflate', '🚀 Still booming', '🤷 Tech stays, business crashes'],
    shares: [0.16, 0.34, 0.12, 0.38],
  },
  'seg-clinic': { kind: 'cloud', prompt: 'One word: your biggest blocker this month', words: BLOCKER_WORDS },
  'seg-boss': { kind: 'boss', prompt: 'Sum of the even numbers', config: { problem: 1 } },
}

/** Every knob the toolbar (and the URL) sets. */
export interface Knobs {
  view: 'presenter' | 'phone' | 'both' | 'board'
  seg: number
  /** `fresh`: opened when the knob was set, on the real clock (the 8 s reveal, Kers' 20 s intro play out). */
  act: 'ready' | 'fresh' | 'hidden' | 'live' | 'closed'
  n: number
  time: 'ontime' | '1min' | 'over'
  boss: 'intro' | 'running' | 'verdict'
  pct: number
  phone: PhoneState
  meet: 'pre' | 'live' | 'ended'
  pres: 'me' | 'other'
  sim: boolean
  dark: boolean
}

export const PHONE_STATES = ['auto', 'guest', 'waiting', 'poll', 'voted', 'cloud', 'blocked', 'boss', 'boss-results', 'boss-error', 'watch', 'notlive'] as const
export type PhoneState = (typeof PHONE_STATES)[number]

const pick = <T extends string>(v: string | null, all: readonly T[], d: T): T => (all.includes(v as T) ? (v as T) : d)

export function readKnobs(q: URLSearchParams): Knobs {
  const seg = Math.min(AGENDA.length, Math.max(1, Number(q.get('seg')) || 4))
  return {
    view: pick(q.get('view'), ['presenter', 'phone', 'both', 'board'], 'presenter'),
    seg,
    act: pick(q.get('act'), ['ready', 'fresh', 'hidden', 'live', 'closed'], 'live'),
    n: Math.min(200, Math.max(1, Number(q.get('n')) || 20)),
    time: pick(q.get('time'), ['ontime', '1min', 'over'], 'ontime'),
    boss: pick(q.get('boss'), ['intro', 'running', 'verdict'], 'running'),
    pct: Math.min(100, Math.max(0, Number(q.get('pct') ?? 62) || 0)),
    phone: pick(q.get('phone'), PHONE_STATES, 'auto'),
    meet: pick(q.get('meet'), ['pre', 'live', 'ended'], 'live'),
    pres: pick(q.get('pres'), ['me', 'other'], 'me'),
    sim: q.get('sim') === '1',
    dark: q.get('dark') === '1',
  }
}

/** The simulation's progress, 0..1, from the wall clock: a 30 s fill, a 6 s hold, again. Same in every frame. */
export function simProgress(now: number): number {
  return Math.min(1, ((now / 1000) % 36) / 30)
}

/** Split `total` by `shares`, whole numbers that add up (largest remainder). */
function split(total: number, shares: number[]): number[] {
  const raw = shares.map(s => s * total)
  const out = raw.map(Math.floor)
  let left = total - out.reduce((a, b) => a + b, 0)
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0])
  for (const [, i] of order) { if (left-- <= 0) break; out[i]++ }
  return out
}

/**
 * The segment's activity. `t0` is when the knobs were set (fixed times hang
 * off it, so clocks tick); `now` pins what must stay put (the 8 s reveal,
 * Kers' 20 s intro).
 */
export function buildActivity(k: Knobs, segId: string, t0: number, now: number): PublicActivity | null {
  const spec = ACTIVITIES[segId]
  if (!spec) return null
  const fresh = k.act === 'fresh'
  // Just opened: answers trickle in over 25 s. Simulating: the 36 s loop.
  const progress = fresh ? Math.min(1, (now - t0) / 25_000) : k.sim ? simProgress(now) : 1
  let status: PublicActivity['status'] = k.act === 'ready' ? 'ready' : k.act === 'closed' ? 'closed' : 'open'
  let openedAt: string | null = k.act === 'ready' ? null : fresh ? iso(t0) : k.act === 'hidden' ? iso(now - 3000) : iso(t0 - 45_000)
  let closedAt: string | null = k.act === 'closed' ? iso(t0 - 5000) : null
  if (spec.kind === 'boss' && k.act !== 'ready' && !fresh) {
    if (k.boss === 'intro') { status = 'open'; openedAt = iso(now - 6000); closedAt = null }
    else if (k.boss === 'running') { status = 'open'; openedAt = iso(t0 - 190_000); closedAt = null }
    else { status = 'closed'; openedAt = iso(t0 - BOSS_MS - 5000); closedAt = iso(t0 - 5000) }
  }
  const a: PublicActivity = {
    id: `mock-${segId}`,
    segmentId: segId,
    kind: spec.kind,
    prompt: spec.prompt,
    options: spec.options ?? [],
    config: spec.config ?? {},
    status,
    openedAt,
    closedAt,
    answered: 0,
    total: 0,
    counts: null,
    words: null,
    tally: null,
  }
  if (status === 'ready') {
    if (spec.kind === 'poll') a.counts = spec.options!.map(() => 0)
    return a
  }
  // How far the room has got: the first seconds of a poll are a trickle.
  const reach = k.act === 'hidden' ? 0.35 : status === 'closed' ? 0.95 : 0.85
  const answered = Math.round(k.n * reach * progress)
  if (spec.kind === 'poll') {
    a.counts = split(answered, spec.shares!)
    a.answered = a.total = answered
  } else if (spec.kind === 'cloud') {
    const scale = (k.n / 20) * progress * (status === 'closed' ? 1 : 0.9)
    const words = spec.words!
      .map(([word, n], i) => ({ word, n: Math.max(0, Math.round(n * scale - (n === 1 ? (i % 3) * 0.4 * (1 - progress) : 0))) }))
      .filter(w => w.n > 0)
      .sort((x, y) => y.n - x.n || x.word.localeCompare(y.word))
    a.words = words
    a.total = words.reduce((s, w) => s + w.n, 0)
    a.answered = Math.min(answered, Math.ceil(a.total / 2))
  } else {
    const intro = fresh ? now - t0 < 20_000 : k.boss === 'intro'
    let trying = intro ? Math.round(k.n * 0.15) : Math.round(k.n * 0.8 * progress)
    // A room size near that where the asked-for % comes out exact (5 of 8 is 62%), as the server floors it.
    const exact = (t: number) => t > 0 && Math.floor((Math.round((k.pct / 100) * t) / t) * 100) === k.pct
    if (!intro && !exact(trying)) trying = [...Array(8)].map((_, i) => [trying - i, trying + i]).flat().find(t => t <= k.n && exact(t)) ?? trying
    const passed = intro ? 0 : Math.round((k.pct / 100) * trying)
    a.tally = { passed, trying, pct: trying ? Math.floor((passed / trying) * 100) : 0 }
    a.answered = a.total = trying
  }
  return a
}

/** Seconds left in the segment, by the time knob. */
function remainingFor(k: Knobs, seg: Segment): number {
  if (k.time === '1min') return 55
  if (k.time === 'over') return -150
  return Math.round(seg.minutes * 60 * 0.6)
}

export function buildState(k: Knobs, t0: number, now: number): MeetingState {
  const seg = AGENDA[k.seg - 1]
  const before = AGENDA.slice(0, k.seg - 1).reduce((s, x) => s + x.minutes * 60, 0)
  const into = seg.minutes * 60 - remainingFor(k, seg)
  const segStart = t0 - into * 1000
  const live = k.meet === 'live'
  const activity = live ? buildActivity(k, seg.id, t0, now) : null
  const room: RoomState | null = live
    ? { cycleId: CYCLE, live: true, participants: k.n, segment: seg.id, activity, warm: true, at: iso(now) }
    : null
  return {
    cycle: { id: CYCLE, label: 'November', meeting_at: iso(t0 - before * 1000 - into * 1000) },
    me: ME,
    presenterName: k.pres === 'other' ? 'ananya' : 'you',
    serverNow: iso(t0),
    room,
    meeting: {
      cycleId: CYCLE,
      meetUrl: null,
      agenda: AGENDA,
      notes: [],
      recordingUrl: null,
      recap: null,
      agendaPostedAt: null,
      recapPostedAt: null,
      startedAt: k.meet === 'pre' ? null : iso(segStart - before * 1000),
      endedAt: k.meet === 'ended' ? iso(t0) : null,
      presenterId: k.meet === 'pre' ? null : k.pres === 'other' ? OTHER : ME,
      currentSegment: k.meet === 'pre' ? null : seg.id,
      segmentStartedAt: k.meet === 'pre' ? null : iso(segStart),
      presenterReady: true,
    },
  }
}

// ─── The phone ───

/** The Boss Round run that went wrong in three ways: wrong answers and a runaway loop. */
const BUGGY_CODE = `function sumEvens(nums) {
  let sum = 0
  let i = 0
  while (i < nums.length) {
    if (nums[i] % 2 === 0) sum += nums[i]
    if (nums[i] < 0) continue
    i++
  }
  return sum || null
}
`
const BUGGY_RESULTS: CaseResult[] = [
  { ok: true, got: '6' },
  { ok: false, got: 'null' },
  { ok: false, got: 'null' },
  timedOut(),
  { ok: false, got: 'null' },
  { ok: true, got: '10' },
]
const SYNTAX_CODE = `function sumEvens(nums) {
  return nums
    .filter(n => n % 2 === 0)
    .reduce((a, b) => a + b, 0
}
`

/** Which activity the phone state wants, whatever the segment. */
function phoneSegment(k: Knobs): string {
  const seg = AGENDA[k.seg - 1].id
  switch (k.phone) {
    case 'poll':
    case 'voted':
      return ACTIVITIES[seg]?.kind === 'poll' ? seg : 'seg-topic'
    case 'cloud':
    case 'blocked':
      return ACTIVITIES[seg]?.kind === 'cloud' ? seg : 'seg-warmup'
    case 'boss':
    case 'boss-results':
    case 'boss-error':
      return 'seg-boss'
    default:
      return seg
  }
}

export interface PhoneSetup {
  view: MeetView
  room: RoomState
  demo?: PhoneDemo
}

export function buildPhone(k: Knobs, t0: number, now: number): PhoneSetup {
  const p = k.phone
  const segId = phoneSegment(k)
  const forced = p !== 'auto' && p !== 'guest' && p !== 'waiting' && p !== 'watch' && p !== 'notlive'
  const knobs: Knobs = forced ? { ...k, act: 'live', boss: 'running' } : k
  let activity = buildActivity(knobs, segId, t0, now)
  if (p === 'waiting' || p === 'watch') activity = activity && activity.status === 'open' ? { ...activity, status: 'closed' } : activity
  const room: RoomState = {
    cycleId: CYCLE,
    live: p !== 'notlive' && k.meet === 'live',
    participants: p === 'waiting' ? Math.max(1, Math.round(k.n * 0.6)) : k.n,
    segment: segId,
    activity: p === 'waiting' ? null : activity,
    warm: p !== 'waiting',
    at: iso(now),
  }
  const id = activity?.id ?? ''
  let mine: Mine | null = null
  let demo: PhoneDemo | undefined
  if (p === 'voted') mine = { activityId: id, values: [{ option: 3 }] }
  if (p === 'cloud' || p === 'blocked') {
    const two = segId === 'seg-clinic' ? ['flaky tests', 'meetings'] : ['jugaad', 'deadline']
    mine = { activityId: id, values: two.map(word => ({ word })) }
  }
  if (p === 'blocked') demo = { refused: BLOCKED_MESSAGE }
  if (p === 'boss-results') {
    mine = { activityId: id, values: [{ passed: false, tests: 2, of: 6 }] }
    demo = { code: BUGGY_CODE, results: BUGGY_RESULTS, fatal: null }
  }
  if (p === 'boss-error') demo = { code: SYNTAX_CODE, fatal: 'SyntaxError: missing ) after argument list' }
  const view: MeetView = {
    cycleId: CYCLE,
    label: 'November',
    ready: true,
    room,
    member: p === 'guest' ? null : 'riya',
    joined: p === 'guest' ? null : p === 'blocked' ? { kind: 'guest', name: 'Kabir' } : { kind: 'member', name: null },
    mine,
  }
  return { view, room, demo }
}
