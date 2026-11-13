/**
 * The Boss Round's three stages (docs/08-meeting-mode-v2.md, Batch 4). Each
 * stage is its own activity slide, with its own ring and a reveal after it:
 *
 *   predict  "Predict the output": code on the screen and every phone, four
 *            answer tiles. One tap locks it, as a poll. Default 1:00
 *   fill     "Fill the blank": code with one or two `___` gaps; phones tap
 *            token chips to fill them, Submit locks. Default 1:30
 *   boss     "Write it": the original Boss Round (CodeMirror plus tests,
 *            ./boss.ts), laptops only; phones watch ("4 coding · 2 passed")
 *            and cheer. Default 5:00
 *
 * Scores are anonymous: the share of the room that got it right, per stage.
 * No leaderboard. The right answer stays on the server until the stage has
 * closed (publicConfig): phones get the code, the tiles and the chips only.
 * Answers are graded by the server from what was tapped (never "I was right").
 *
 * Pure, type-only imports: runs under `node --test`, and client components
 * may import it.
 */

import type { ActivityKind, ActivityStatus } from './activity.ts'

export type StageKind = 'predict' | 'fill' | 'boss'
export const STAGE_KINDS: StageKind[] = ['predict', 'fill', 'boss']

export const STAGE_LABELS: Record<StageKind, string> = {
  predict: 'Predict the output',
  fill: 'Fill the blank',
  boss: 'Write it',
}

export function isStage(kind: ActivityKind | string | null | undefined): kind is StageKind {
  return kind === 'predict' || kind === 'fill' || kind === 'boss'
}

/** The quiz stages: one locked answer, graded right or wrong. */
export function isQuiz(kind: ActivityKind | string | null | undefined): kind is 'predict' | 'fill' {
  return kind === 'predict' || kind === 'fill'
}

/** The code a stage shows: at most this many characters (about 12 short lines). */
export const CODE_MAX = 600
/** A gap in fill-the-blank code: three or more underscores. */
export const BLANK_RE = /_{3,}/g
export const MAX_BLANKS = 2
/** A chip's text, and how many chips (answers and decoys together). */
export const TOKEN_MAX = 30
export const MAX_CHIPS = 8

const objectOf = (raw: unknown): Record<string, unknown> => (raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {})
const text = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '')
const token = (v: unknown) => (typeof v === 'string' ? v.trim().slice(0, TOKEN_MAX) : '')

// ─── Config ───────────────────────────────────────────────────────────────

export interface PredictConfig {
  code: string
  /** The right tile's index (into the activity's options). Server only until close. */
  answer: number | null
}

export interface FillConfig {
  code: string
  /** The right token per blank, in order. Server only until close. */
  answers: string[]
  /** Wrong chips offered beside them. */
  decoys: string[]
}

export function predictConfig(raw: unknown): PredictConfig {
  const r = objectOf(raw)
  const answer = Number(r.answer)
  return { code: text(r.code, CODE_MAX), answer: Number.isInteger(answer) && answer >= 0 && answer < 4 ? answer : null }
}

export function fillConfig(raw: unknown): FillConfig {
  const r = objectOf(raw)
  const list = (v: unknown) => (Array.isArray(v) ? v.map(token) : [])
  return { code: text(r.code, CODE_MAX), answers: list(r.answers).slice(0, MAX_BLANKS), decoys: list(r.decoys).filter(Boolean).slice(0, MAX_CHIPS) }
}

/** How many gaps the code has (`___`), at most MAX_BLANKS counted. */
export function blankCount(code: string): number {
  return Math.min(MAX_BLANKS, (code.match(BLANK_RE) ?? []).length)
}

/**
 * The code cut at its gaps: the text before each blank, then what's after
 * the last one (parts = blanks + 1). Gaps past MAX_BLANKS stay as text.
 */
export function splitBlanks(code: string): string[] {
  const parts: string[] = []
  let last = 0
  let n = 0
  for (const m of code.matchAll(BLANK_RE)) {
    if (n >= MAX_BLANKS) break
    parts.push(code.slice(last, m.index))
    last = (m.index ?? 0) + m[0].length
    n++
  }
  parts.push(code.slice(last))
  return parts
}

/** A small stable hash (FNV-1a), for the chips' order. */
function hash(s: string): number {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193) >>> 0
  return h
}

/**
 * The chips a phone offers: the right tokens and the decoys together, each
 * once, in an order fixed by `seed` (the activity) but not by which are
 * right, so the first chip is no tell.
 */
export function fillChips(cfg: Pick<FillConfig, 'answers' | 'decoys'>, seed: string): string[] {
  const all = [...new Set([...cfg.answers, ...cfg.decoys].filter(Boolean))].slice(0, MAX_CHIPS)
  return all.map(t => ({ t, k: hash(`${seed}:${t}`) })).sort((a, b) => a.k - b.k || a.t.localeCompare(b.t)).map(x => x.t)
}

/**
 * A stage's config as anyone outside the server may see it. Until the stage
 * has closed the right answer is gone: predict keeps its code, fill its code,
 * how many blanks and the chips (shuffled). Once closed, the answer joins it
 * for the reveal. Any other kind's config is passed as it is.
 */
export function publicConfig(kind: ActivityKind, raw: unknown, status: ActivityStatus, seed: string): Record<string, unknown> {
  const r = objectOf(raw)
  const closed = status === 'closed'
  if (kind === 'predict') {
    const c = predictConfig(r)
    return { code: c.code, ...(closed && c.answer !== null ? { answer: c.answer } : {}) }
  }
  if (kind === 'fill') {
    const c = fillConfig(r)
    return { code: c.code, blanks: blankCount(c.code), chips: fillChips(c, seed), ...(closed ? { answers: c.answers } : {}) }
  }
  return r
}

/** What a phone reads from a fill stage's public config. */
export function fillPublic(raw: unknown): { code: string; blanks: number; chips: string[]; answers: string[] | null } {
  const r = objectOf(raw)
  const code = text(r.code, CODE_MAX)
  const chips = Array.isArray(r.chips) ? r.chips.map(token).filter(Boolean).slice(0, MAX_CHIPS) : []
  const answers = Array.isArray(r.answers) ? r.answers.map(token) : null
  return { code, blanks: blankCount(code), chips, answers }
}

/** What a phone reads from a predict stage's public config: the right tile only once closed. */
export function predictPublic(raw: unknown): { code: string; answer: number | null } {
  return predictConfig(raw)
}

// ─── Answers ──────────────────────────────────────────────────────────────

/** A fill answer as a phone sent it: one chip per blank, each one of the chips offered. Null when it isn't. */
export function cleanFill(cfg: FillConfig, raw: unknown): string[] | null {
  const tokens = objectOf(raw).tokens
  const blanks = blankCount(cfg.code)
  if (!Array.isArray(tokens) || tokens.length !== blanks || !blanks) return null
  const offered = new Set([...cfg.answers, ...cfg.decoys].filter(Boolean))
  const out = tokens.map(token)
  return out.every(t => t && offered.has(t)) ? out : null
}

/** Whether a fill answer is right: every blank, in order, exactly (spaces at the ends aside). */
export function gradeFill(tokens: unknown, answers: string[]): boolean {
  if (!Array.isArray(tokens) || !answers.length || tokens.length !== answers.length) return false
  return answers.every((a, i) => token(tokens[i]) === a.trim() && a.trim() !== '')
}

/** Whether a predict answer is the right tile. */
export function gradePredict(option: unknown, answer: number | null): boolean {
  return answer !== null && Number(option) === answer && Number.isInteger(Number(option))
}

/** A quiz stage's score: how many answered, how many got it right, and that as a floored %. */
export interface QuizTally {
  correct: number
  answered: number
  pct: number
}

/** The room's score on a quiz stage, one answer per person (slot 0). */
export function quizTally(kind: 'predict' | 'fill', config: unknown, rows: { participant_id: string; slot: number; value: unknown }[]): QuizTally {
  const seen = new Set<string>()
  let correct = 0
  const p = kind === 'predict' ? predictConfig(config) : null
  const f = kind === 'fill' ? fillConfig(config) : null
  for (const r of rows) {
    if (r.slot !== 0 || seen.has(r.participant_id)) continue
    seen.add(r.participant_id)
    const v = objectOf(r.value)
    if (p ? gradePredict(v.option, p.answer) : gradeFill(v.tokens, f!.answers)) correct++
  }
  const answered = seen.size
  return { correct, answered, pct: answered ? Math.floor((correct / answered) * 100) : 0 }
}

// ─── The editor ───────────────────────────────────────────────────────────

/** Why a stage can't be written to its row yet, or null when it's complete. */
export function stageProblem(kind: ActivityKind, options: string[], config: unknown): string | null {
  if (kind === 'predict') {
    const c = predictConfig(config)
    if (!c.code.trim()) return 'Add the code.'
    if (options.length < 2) return 'It needs at least two answers.'
    if (c.answer === null || c.answer >= options.length) return 'Pick the right answer.'
    return null
  }
  if (kind === 'fill') {
    const c = fillConfig(config)
    const blanks = blankCount(c.code)
    if (!blanks) return 'Mark a blank in the code with ___.'
    if (c.answers.length < blanks || c.answers.slice(0, blanks).some(a => !a.trim())) return `Give the right token for ${blanks === 1 ? 'the blank' : 'each blank'}.`
    return null
  }
  return null
}

/** The stages `+ Add` › Boss Round inserts, as each slide's activity. */
export const STAGE_SAMPLES = {
  predict: {
    prompt: 'What does this print?',
    options: ['3', '4', 'undefined', 'TypeError'],
    config: { code: 'const a = [1, 2, 3]\nconst b = a\nb.push(4)\nconsole.log(a.length)', answer: 1 },
  },
  fill: {
    prompt: 'Fill the blanks: the sum of the even numbers',
    config: { code: 'const total = nums\n  .___(n => n % 2 === 0)\n  .___((sum, n) => sum + n, 0)', answers: ['filter', 'reduce'], decoys: ['map', 'forEach', 'find', 'some'] },
  },
  boss: {
    prompt: 'Write it',
    config: { problem: 1 },
  },
} as const

/** Kers on a quiz stage's score, once it's closed. */
export function quizVerdict(pct: number, answered: number): string {
  if (answered === 0) return 'Nobody answered. Shy, or stumped?'
  if (pct === 100) return answered === 1 ? 'One answer, and right. Suspicious.' : 'Everyone got it. I’ll make the next one harder.'
  if (pct === 0) return 'Nobody got it. That one was a trap, to be fair.'
  if (pct < 40) return `${pct}% got it. JavaScript wins this round.`
  if (pct < 70) return `${pct}% got it. A respectable split.`
  return `${pct}% got it. Fine. You know your stuff.`
}
