/**
 * Rehearsal (/meet/present?rehearse=1): the presenter screen on the real
 * agenda and prep, the day before, with nothing live and nothing written.
 * Activities the presenter "opens" fill with sample answers here, over
 * about 25 s, so the poll's reveal, the cloud and the Boss Round can be
 * practised. Pure: no runtime imports, so it runs under `node --test`.
 */

import type { PublicActivity } from './activity.ts'
import { expired } from './timer.ts'

/** How many people the rehearsal pretends are in the room. */
export const REHEARSE_ROOM = 20
const FILL_MS = 25_000

/** Sample words: what a room might say, clearly not anyone's real answer. */
const SAMPLE_WORDS: [string, number][] = [
  ['coffee', 6], ['terminal', 5], ['vs code', 4], ['git', 3], ['vim', 3], ['notes', 2], ['tmux', 2],
  ['flaky tests', 2], ['meetings', 2], ['docker', 1], ['keyboard', 1], ['raycast', 1], ['figma', 1], ['ci', 1],
]

/** Split `total` by `shares`, whole numbers that add up (largest remainder). */
export function split(total: number, shares: number[]): number[] {
  const sum = shares.reduce((a, b) => a + b, 0) || 1
  const raw = shares.map(s => (s / sum) * total)
  const out = raw.map(Math.floor)
  let left = total - out.reduce((a, b) => a + b, 0)
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0])
  for (const [, i] of order) {
    if (left-- <= 0) break
    out[i]++
  }
  return out
}

/** An activity's state in rehearsal, kept in the presenter's browser only. */
export interface RehearsedLocal {
  status: PublicActivity['status']
  openedAt: string | null
  /** Its countdown (lib/meet/timer.ts), as the server would store it. */
  closesAt?: string | null
}

/**
 * An activity in rehearsal: as stored (ready) until the presenter opens it,
 * then sample answers that grow for ~25 s from `openedAt`. Its countdown
 * runs as live: once `closesAt` passes it's closed, as the server would
 * close it. Never names anyone.
 */
export function rehearseActivity(
  a: PublicActivity,
  local: RehearsedLocal | undefined,
  now: number,
  room = REHEARSE_ROOM,
): PublicActivity {
  const closesAt = local?.closesAt ?? null
  const status = local?.status === 'open' && expired(closesAt, now) ? 'closed' : local?.status ?? 'ready'
  const openedAt = local?.openedAt ?? null
  const base: PublicActivity = { ...a, status, openedAt, closedAt: status === 'closed' ? new Date(now).toISOString() : null, closesAt, answered: 0, total: 0, counts: null, words: null, tally: null }
  if (status === 'ready' || !openedAt) {
    if (a.kind === 'poll') base.counts = a.options.map(() => 0)
    return base
  }
  const progress = status === 'closed' ? 1 : Math.max(0, Math.min(1, (now - new Date(openedAt).getTime()) / FILL_MS))
  const answered = Math.round(room * 0.85 * progress)
  switch (a.kind) {
    case 'poll': {
      const shares = a.options.map((_, i) => [0.18, 0.4, 0.28, 0.14][i % 4])
      base.counts = split(answered, shares)
      base.answered = base.total = answered
      break
    }
    case 'cloud': {
      const words = SAMPLE_WORDS.map(([word, n]) => ({ word, n: Math.round(n * progress * (room / 20)) }))
        .filter(w => w.n > 0)
        .sort((x, y) => y.n - x.n || x.word.localeCompare(y.word))
      base.words = words
      base.total = words.reduce((s, w) => s + w.n, 0)
      base.answered = Math.min(answered, Math.ceil(base.total / 2))
      break
    }
    case 'boss': {
      const trying = Math.round(room * 0.8 * progress)
      const passed = Math.round(trying * 0.6 * progress)
      base.tally = { passed, trying, pct: trying ? Math.floor((passed / trying) * 100) : 0 }
      base.answered = base.total = trying
      break
    }
  }
  return base
}

/**
 * One more person's answers (the rehearsing admin's own phone preview, or
 * preview) on top of an activity's sample answers, counted the way
 * the server's aggregate would: a vote, up to three words, a run's result.
 */
export function withAnswer(a: PublicActivity, values: Record<string, unknown>[] | null | undefined): PublicActivity {
  if (!values?.length || a.status === 'ready') return a
  const out: PublicActivity = { ...a, answered: a.answered + 1 }
  switch (a.kind) {
    case 'poll': {
      const option = Number(values[0]?.option)
      if (!Number.isInteger(option) || !a.counts || option < 0 || option >= a.counts.length) return a
      out.counts = a.counts.map((c, i) => (i === option ? c + 1 : c))
      out.total = a.total + 1
      break
    }
    case 'cloud': {
      const words = [...(a.words ?? [])]
      for (const v of values) {
        const w = String(v.word ?? '')
        if (!w) continue
        const at = words.findIndex(x => x.word === w)
        if (at >= 0) words[at] = { ...words[at], n: words[at].n + 1 }
        else words.push({ word: w, n: 1 })
      }
      out.words = words.sort((x, y) => y.n - x.n || x.word.localeCompare(y.word))
      out.total = a.total + values.length
      break
    }
    case 'boss': {
      const { passed = 0, trying = 0 } = a.tally ?? {}
      const p = passed + (values[0]?.passed === true ? 1 : 0)
      const t = trying + 1
      out.tally = { passed: p, trying: t, pct: Math.floor((p / t) * 100) }
      out.total = t
      break
    }
  }
  return out
}

/** The answers a local phone keeps for one activity after sending `value` (what POST /api/meet would return as `mine`). */
export function addAnswer(kind: PublicActivity['kind'], before: Record<string, unknown>[], value: Record<string, unknown>): Record<string, unknown>[] {
  // A poll vote locks on the first tap, as on the server (lib/meet/room.ts respond).
  if (kind === 'poll') return before.length ? before : [value]
  if (kind !== 'cloud') return [value]
  const w = String(value.word ?? '')
  if (!w || before.some(v => v.word === w)) return before
  return [...before, { word: w }].slice(0, 3)
}
