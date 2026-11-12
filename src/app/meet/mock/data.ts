/**
 * Fake data for the meeting-mode mock (/meet/mock, dev only): the first-run
 * agenda from docs/06-meeting-mode.md with Kers' prep, its activities, a room
 * of ~20 or ~60 people, and the phone's own states. Pure: everything is
 * built from the URL's knobs and the clock, so the presenter and the phone
 * (two iframes in "both") show the same numbers.
 */

import { BLOCKED_MESSAGE, type MeetView, type Mine, type PublicActivity, type RoomState } from '@/lib/meet/activity'
import { timedOut, type CaseResult } from '@/lib/meet/boss'
import { cleanAgenda, type MeetingState, type Segment } from '@/lib/meeting'
import november from '../../../../docs/agendas/2026-11.json'
import type { PresenterPost } from '@/lib/guild/meetingPrep'
import type { PhoneDemo } from '@/components/meet/PhoneActivity'

export const CYCLE = 'mock-cycle'
const ME = 'mock-admin'
const OTHER = 'mock-other-admin'
const iso = (ms: number) => new Date(ms).toISOString()

/**
 * November's real agenda (docs/agendas/2026-11.json, the reference the user
 * reviews): its segments, Kers' prep and openers, and its activities. Only
 * the answers below are invented. The file is read, never changed here.
 */
const NOVEMBER = november as unknown as { cycle: string; meetingAt: string; agenda: Segment[]; activities: { segment: string; kind: PublicActivity['kind']; prompt: string; options: string[]; config?: Record<string, unknown> }[] }

export const AGENDA: Segment[] = cleanAgenda(NOVEMBER.agenda)

/** The board posts the agenda links to, as the presenter shows them (titles from docs/agendas/2026-11.md; counts invented). */
export const POSTS: Record<string, PresenterPost> = {
  '5919d1ce-d4e0-48c3-8908-0e39bea53188': { id: '5919d1ce-d4e0-48c3-8908-0e39bea53188', title: 'Voice-driven development and dev environment setups', description: '', voteCount: 6, commentCount: 3 },
  '61f7a2f7-621b-4b74-b406-39f95844a935': { id: '61f7a2f7-621b-4b74-b406-39f95844a935', title: 'AI Bubble Bust: AI Technology vs. AI as a Business', description: '', voteCount: 14, commentCount: 11 },
  '4968007c-cbf8-4a0a-94f3-458b313a389d': { id: '4968007c-cbf8-4a0a-94f3-458b313a389d', title: 'Data structures in unexpected places', description: '', voteCount: 8, commentCount: 4 },
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

const TOOL_WORDS: [string, number][] = [
  ['vs code', 7], ['terminal', 5], ['cursor', 4], ['coffee', 4], ['git', 3], ['vim', 3], ['raycast', 3],
  ['tmux', 2], ['notion', 2], ['chatgpt', 2], ['postman', 2], ['docker', 2], ['claude', 2], ['figma', 2],
  ['mechanical keyboard', 1], ['jetbrains', 1], ['obsidian', 1], ['zsh', 1], ['second monitor', 1], ['chai', 1],
  ['warp', 1], ['spotify', 1], ['copilot', 1], ['headphones', 1], ['grep', 1], ['jq', 1],
]
const BLOCKER_WORDS: [string, number][] = [
  ['flaky tests', 6], ['code review', 5], ['meetings', 4], ['scope creep', 3], ['context switching', 3], ['ci', 3],
  ['estimates', 2], ['tech debt', 2], ['env setup', 2], ['access', 2], ['approvals', 2], ['bandwidth nahi', 2],
  ['legacy', 1], ['kubernetes', 1], ['jira', 1], ['dependencies', 1], ['prod bugs', 1], ['clarity', 1],
  ['merge conflicts', 1], ['infra', 1], ['hiring', 1], ['deadlines', 1], ['sab urgent hai', 1], ['docs', 1], ['c++', 1],
]
/** Invented answers, per segment: what a room of 20 might say. */
const SAMPLE: Record<string, Pick<ActivitySpec, 'shares' | 'words'>> = {
  warmup: { words: TOOL_WORDS },
  radar: { shares: [0.14, 0.43, 0.31, 0.12] },
  topic: { shares: [0.27, 0.48, 0.25] },
  clinic: { words: BLOCKER_WORDS },
}

export const ACTIVITIES: Record<string, ActivitySpec> = Object.fromEntries(
  NOVEMBER.activities.map(a => [a.segment, { kind: a.kind, prompt: a.prompt, options: a.options, config: a.config, ...SAMPLE[a.segment] }]),
)

/** Segment ids by kind, for the phone states that want one. */
const byKind = (kind: Segment['kind']) => AGENDA.find(s => s.kind === kind)?.id ?? AGENDA[0].id
const SEG = { warmup: byKind('warmup'), topic: byKind('topic'), clinic: byKind('clinic'), boss: byKind('boss') }

/** Every knob the toolbar (and the URL) sets. */
export interface Knobs {
  view: 'presenter' | 'phone' | 'both' | 'board'
  seg: number
  /** `fresh`: opened when the knob was set, on the real clock (the 8 s reveal, Kers' 20 s intro play out). */
  act: 'ready' | 'fresh' | 'hidden' | 'live' | 'closed'
  n: number
  boss: 'intro' | 'running' | 'verdict'
  pct: number
  phone: PhoneState
  meet: 'pre' | 'live' | 'ended'
  pres: 'me' | 'other'
  sim: boolean
  dark: boolean
  /** The rehearsal: /meet/present?rehearse=1 on this agenda (open the activities with the screen's own button). */
  rehearse: boolean
}

export const PHONE_STATES = ['auto', 'guest', 'waiting', 'poll', 'voted', 'cloud', 'blocked', 'boss', 'boss-results', 'boss-error', 'watch', 'notlive'] as const
export type PhoneState = (typeof PHONE_STATES)[number]

const pick = <T extends string>(v: string | null, all: readonly T[], d: T): T => (all.includes(v as T) ? (v as T) : d)

export function readKnobs(q: URLSearchParams): Knobs {
  const seg = Math.min(AGENDA.length, Math.max(1, Number(q.get('seg')) || 1))
  return {
    view: pick(q.get('view'), ['presenter', 'phone', 'both', 'board'], 'presenter'),
    seg,
    act: pick(q.get('act'), ['ready', 'fresh', 'hidden', 'live', 'closed'], 'live'),
    n: Math.min(200, Math.max(1, Number(q.get('n')) || 20)),
    boss: pick(q.get('boss'), ['intro', 'running', 'verdict'], 'running'),
    pct: Math.min(100, Math.max(0, Number(q.get('pct') ?? 62) || 0)),
    phone: pick(q.get('phone'), PHONE_STATES, 'auto'),
    meet: pick(q.get('meet'), ['pre', 'live', 'ended'], 'live'),
    pres: pick(q.get('pres'), ['me', 'other'], 'me'),
    sim: q.get('sim') === '1',
    dark: q.get('dark') === '1',
    rehearse: q.get('rehearse') === '1',
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
    else { status = 'closed'; openedAt = iso(t0 - 6 * 60_000); closedAt = iso(t0 - 5000) }
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

export function buildState(k: Knobs, t0: number, now: number): MeetingState {
  const seg = AGENDA[k.seg - 1]
  const before = AGENDA.slice(0, k.seg - 1).reduce((s, x) => s + x.minutes * 60, 0)
  // Some way into the segment: nothing on screen counts it, but the stamps want a time.
  const into = Math.round(seg.minutes * 60 * 0.4)
  const segStart = t0 - into * 1000
  const live = k.meet === 'live'
  const activity = live ? buildActivity(k, seg.id, t0, now) : null
  const room: RoomState | null = live
    ? { cycleId: CYCLE, live: true, participants: k.n, segment: seg.id, activity, warm: true, at: iso(now) }
    : null
  return {
    cycle: { id: CYCLE, label: 'November', meeting_at: k.meet === 'pre' ? NOVEMBER.meetingAt : iso(t0 - before * 1000 - into * 1000) },
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
      return ACTIVITIES[seg]?.kind === 'poll' ? seg : SEG.topic
    case 'cloud':
    case 'blocked':
      return ACTIVITIES[seg]?.kind === 'cloud' ? seg : SEG.warmup
    case 'boss':
    case 'boss-results':
    case 'boss-error':
      return SEG.boss
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
  if (p === 'voted') mine = { activityId: id, values: [{ option: 1 }] }
  if (p === 'cloud' || p === 'blocked') {
    const two = segId === SEG.clinic ? ['flaky tests', 'meetings'] : ['vs code', 'coffee']
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

/** What the rehearsal page loads: each segment's activity as seeded, ready, with no answers. */
export function rehearsalActivities(): Record<string, PublicActivity> {
  return Object.fromEntries(
    Object.entries(ACTIVITIES).map(([segId, a]) => [
      segId,
      { id: `rehearse-${segId}`, segmentId: segId, kind: a.kind, prompt: a.prompt, options: a.options ?? [], config: a.config ?? {}, status: 'ready', openedAt: null, closedAt: null, answered: 0, total: 0, counts: null, words: null, tally: null } satisfies PublicActivity,
    ]),
  )
}
