/**
 * The slide editor (docs/08-meeting-mode-v2.md, Batch 3), inside Preview
 * slides (/meet/present?rehearse=1): the agenda operations it runs, its undo
 * history, the lock, and how a saved agenda maps onto meeting_activities.
 *
 *   add       poll / word cloud (each with its results slide right after),
 *             the Boss Round (its three stages, each with its results), a topic from the board, a text or title slide, a meme. A new
 *             slide joins the section of the slide it's added after
 *   move      one slide, anywhere (drag on the rail, or the up/down buttons)
 *   delete    a slide; an activity slide takes its results slides with it
 *   undo      the last UNDO_LIMIT changes, client side. Typing in one field
 *             is one change (edits to the same field within COALESCE_MS merge)
 *   lock      read-only once the meeting or a live rehearsal has started:
 *             the server refuses agenda writes then too (editLocked)
 *   rows      on save, every complete activity slide gets its
 *             meeting_activities row (UNIQUE(cycle_id, segment_id), the
 *             slide's id): created, or updated while nobody has answered.
 *             A row whose slide is gone (or no longer an activity slide) is
 *             deleted only when it has no answers; otherwise it's kept
 *
 * Pure, imports by path only: runs under `node --test`, and client
 * components may import it.
 */

import { hasOptions, meetingLive, slideKind, type Meme, type MeetPost, type Segment, type SegmentKind, type SlideActivity } from '../meeting.ts'
import { optionsOf, type ActivityKind, type ActivityStatus, type PublicActivity } from './activity.ts'
import { rehearsalOn } from './liveRehearsal.ts'
import { STAGE_LABELS, STAGE_SAMPLES, stageProblem } from './bossStages.ts'

/** What `+ Add` offers. */
export type AddKind = 'poll' | 'cloud' | 'boss' | 'topic' | 'text' | 'title' | 'meme'

export const ADD_LABELS: Record<AddKind, string> = {
  poll: 'Poll',
  cloud: 'Word cloud',
  boss: 'Boss Round (3 stages)',
  topic: 'Topic from the board',
  text: 'Text',
  title: 'Title',
  meme: 'Meme',
}

/** How many changes Undo goes back. */
export const UNDO_LIMIT = 20
/** Edits to the same field closer together than this are one change (typing a word). */
export const COALESCE_MS = 1200
/** The editor saves this long after the last change. */
export const AUTOSAVE_MS = 800

// ─── Lock ──────────────────────────────────────────────────────

/**
 * Whether the slides are locked: the meeting is live, or a live rehearsal is
 * running (both run off the stored agenda and its activity rows). The editor
 * goes read-only and the server refuses agenda writes. After End (or once a
 * rehearsal ends) it unlocks.
 */
export function editLocked(
  m: { startedAt: string | null; endedAt: string | null; rehearsalCode?: string | null; rehearsalStartedAt?: string | null } | null | undefined,
  now = Date.now(),
): boolean {
  return meetingLive(m, now) || rehearsalOn(m, now)
}

export const LOCKED_MESSAGE = 'The meeting is on: slides are locked until it ends.'

// ─── Building slides ───────────────────────────────────────────

/** An id not yet on the agenda: `base`, else `base-2`, `base-3`… (at most 40 characters). */
export function uniqueId(agenda: Pick<Segment, 'id'>[], base: string): string {
  const stem = (base.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'slide').slice(0, 34)
  const taken = new Set(agenda.map(s => s.id))
  if (!taken.has(stem)) return stem
  for (let n = 2; ; n++) if (!taken.has(`${stem}-${n}`)) return `${stem}-${n}`
}

export interface AddContext {
  /** The section (and its kind) the new slide joins: the slide it's added after. */
  section?: string
  kind?: SegmentKind
  /** topic: the board post. */
  post?: Pick<MeetPost, 'id' | 'title'>
  /** meme: what it shows (a Kers meme by default). */
  meme?: Meme
}

const DEFAULT_MEME: Meme = { panels: [{ label: 'Me', text: 'A quick one, I promise.', face: 'smug' }] }

/**
 * The slide(s) `+ Add` inserts. A poll or word cloud comes with its results
 * slide (`of` it), so closing it moves straight on to its results.
 */
export function makeSlides(kind: AddKind, agenda: Pick<Segment, 'id'>[], ctx: AddContext = {}): Segment[] {
  const base = { kind: ctx.kind ?? 'custom', ...(ctx.section ? { section: ctx.section } : {}), detail: '', minutes: 0, topicIds: [] as string[], prep: null }
  switch (kind) {
    case 'poll':
    case 'cloud': {
      const id = uniqueId(agenda, kind)
      const results = uniqueId([...agenda, { id }], `${kind}-results`)
      const activity: SlideActivity = kind === 'poll' ? { kind: 'poll', prompt: 'Your question', options: ['Yes', 'No'] } : { kind: 'cloud', prompt: 'One word for…' }
      return [
        { ...base, id, slide: 'activity', title: kind === 'poll' ? 'Vote' : 'One word', cue: kind === 'poll' ? 'Vote on your phone.' : 'One word on your phone. Nobody sees who typed what.', activity },
        { ...base, id: results, slide: 'results', of: id, title: kind === 'poll' ? 'The room says' : 'In your words', cue: kind === 'poll' ? 'Smallest camp: defend it.' : 'Biggest word wins.' },
      ]
    }
    case 'boss': {
      // Three stages, each an activity slide with its own ring and its reveal right after.
      const bossBase = { ...base, kind: 'boss' as const, section: 'Boss Round' }
      const out: Segment[] = []
      const taken = () => [...agenda, ...out]
      const stage = (k: 'predict' | 'fill' | 'boss', title: string, cue: string, resultsTitle: string, resultsCue: string, activity: SlideActivity) => {
        const id = uniqueId(taken(), k === 'boss' ? 'boss-write' : `boss-${k}`)
        out.push({ ...bossBase, id, slide: 'activity', title, cue, activity })
        out.push({ ...bossBase, id: uniqueId(taken(), `${id}-results`), slide: 'results', of: id, title: resultsTitle, cue: resultsCue })
      }
      const p = STAGE_SAMPLES.predict
      const f = STAGE_SAMPLES.fill
      const w = STAGE_SAMPLES.boss
      stage('predict', STAGE_LABELS.predict, 'Tap your answer on your phone. One tap locks it.', 'Who called it', 'Anyone want to explain it?', { kind: 'predict', prompt: p.prompt, options: [...p.options], config: { ...p.config } })
      stage('fill', STAGE_LABELS.fill, 'Tap the chips on your phone to fill the gaps.', 'The answer', 'Who had another way?', { kind: 'fill', prompt: f.prompt, config: { ...f.config, answers: [...f.config.answers], decoys: [...f.config.decoys] } })
      stage('boss', STAGE_LABELS.boss, 'Laptops: write it and run the tests. Phones: cheer them on.', 'Kers’ verdict', 'Who passed? Show us how.', { kind: 'boss', prompt: w.prompt, config: { ...w.config } })
      return out
    }
    case 'topic': {
      const post = ctx.post
      return [{ ...base, id: uniqueId(agenda, 'topic'), slide: 'content', title: (post?.title ?? 'A topic from the board').slice(0, 80), cue: 'Read it, then pick a side.', topicIds: post ? [post.id] : [], ...(post ? { cards: [{ kind: 'post', postId: post.id }] } : {}) }]
    }
    case 'text':
      return [{ ...base, id: uniqueId(agenda, 'text'), slide: 'text', title: 'One big line', cue: '' }]
    case 'title':
      return [{ ...base, id: uniqueId(agenda, 'title'), slide: 'title', title: 'Next up', cue: '' }]
    case 'meme':
      return [{ ...base, id: uniqueId(agenda, 'meme'), slide: 'meme', title: '', meme: ctx.meme ?? DEFAULT_MEME }]
  }
}

/** `slides` inserted right after `afterId` (at the end when it's null or missing). */
export function insertAfter(agenda: Segment[], afterId: string | null, slides: Segment[]): Segment[] {
  const i = afterId ? agenda.findIndex(s => s.id === afterId) : -1
  const at = i >= 0 ? i + 1 : agenda.length
  return [...agenda.slice(0, at), ...slides, ...agenda.slice(at)]
}

/** The slide at `from` moved to `to` (indexes clamped; same order when out of range). */
export function moveSlide<T>(agenda: T[], from: number, to: number): T[] {
  if (from < 0 || from >= agenda.length) return agenda
  const target = Math.max(0, Math.min(agenda.length - 1, to))
  if (target === from) return agenda
  const next = [...agenda]
  const [s] = next.splice(from, 1)
  next.splice(target, 0, s)
  return next
}

/** The slide gone; an activity slide takes the results slides that show it. */
export function removeSlide(agenda: Segment[], id: string): Segment[] {
  const s = agenda.find(x => x.id === id)
  if (!s) return agenda
  const isActivity = slideKind(s, !!s.activity) === 'activity'
  return agenda.filter(x => x.id !== id && !(isActivity && x.slide === 'results' && x.of === id))
}

/** One slide patched. */
export function updateSlide(agenda: Segment[], id: string, patch: Partial<Segment>): Segment[] {
  return agenda.map(s => (s.id === id ? { ...s, ...patch } : s))
}

// ─── Undo ──────────────────────────────────────────────────────

export interface History<T> {
  /** Older states, oldest first; at most UNDO_LIMIT. */
  past: T[]
  present: T
  future: T[]
  /** What the last change edited (a field), so typing merges into one change. */
  key: string | null
  at: number
}

export function startHistory<T>(present: T): History<T> {
  return { past: [], present, future: [], key: null, at: 0 }
}

/**
 * A change. With a `key` (the field edited) equal to the last change's and
 * within COALESCE_MS, it replaces the present (the same change, still being
 * typed); otherwise the present goes onto the undo stack (the oldest drops
 * off past UNDO_LIMIT). Any change clears redo.
 */
export function commit<T>(h: History<T>, next: T, key: string | null = null, now = Date.now(), limit = UNDO_LIMIT): History<T> {
  if (next === h.present) return h
  const merge = key !== null && key === h.key && now - h.at < COALESCE_MS && h.past.length > 0
  return {
    past: merge ? h.past : [...h.past, h.present].slice(-limit),
    present: next,
    future: [],
    key,
    at: now,
  }
}

export function undo<T>(h: History<T>): History<T> {
  if (!h.past.length) return h
  return { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future], key: null, at: 0 }
}

export function redo<T>(h: History<T>): History<T> {
  if (!h.future.length) return h
  return { past: [...h.past, h.present].slice(-UNDO_LIMIT), present: h.future[0], future: h.future.slice(1), key: null, at: 0 }
}

// ─── meeting_activities ────────────────────────────────────────

/** A meeting_activities row, as the sync reads it. */
export interface ActivityRowLite {
  id: string
  segment_id: string
  kind: ActivityKind
  prompt: string
  options: unknown
  config: unknown
  status: ActivityStatus
}

/** What a complete activity writes: the DB's checks (a prompt, a poll's 2-4 options). */
export interface ActivityFields {
  kind: ActivityKind
  prompt: string
  options: string[]
  config: Record<string, unknown>
}

/**
 * An activity slide's activity, ready for its row: null while incomplete (no
 * prompt, a poll short of two options, a Boss stage without its code or its
 * right answer: bossStages.ts stageProblem).
 */
export function activityComplete(a: SlideActivity | null | undefined): ActivityFields | null {
  if (!a) return null
  const prompt = a.prompt.trim()
  if (!prompt) return null
  // A predict stage's right answer is an index into its tiles: they're kept in place (blanks included) so it still points right.
  const raw = hasOptions(a.kind) ? (a.options ?? []).map(o => o.trim()).slice(0, 4) : []
  if (a.kind === 'predict' && raw.some(o => !o)) return null
  const options = raw.filter(Boolean)
  if (hasOptions(a.kind) && options.length < 2) return null
  if (stageProblem(a.kind, options, a.config)) return null
  return { kind: a.kind, prompt, options, config: a.config ?? {} }
}

/** JSON with sorted keys, so jsonb's reordering never reads as a change. */
function stable(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(stable).join(',')}]`
  if (v && typeof v === 'object') return `{${Object.keys(v).sort().map(k => `${JSON.stringify(k)}:${stable((v as Record<string, unknown>)[k])}`).join(',')}}`
  return JSON.stringify(v ?? null)
}

export interface ActivityPlan {
  insert: (ActivityFields & { segment_id: string })[]
  update: { id: string; patch: Partial<ActivityFields> }[]
  /** Rows to delete: their slide is gone, and nobody answered. */
  remove: string[]
  /** Slide ids whose row was left as it is: it has answers (or is open), so its kind and options can't change. */
  kept: string[]
  /** Activity slides not written yet: no prompt, or a poll with fewer than two options. */
  incomplete: string[]
}

/** Whether a slide is an activity slide (an old segment only when it carries an activity). */
const isActivitySlide = (s: Segment) => slideKind(s, !!s.activity) === 'activity'

/**
 * What saving `agenda` does to the month's meeting_activities (`answers`:
 * how many responses each row has, by row id):
 *
 *   - a complete activity slide with no row: insert it (a Boss stage needs
 *     migration 050's kinds: meetingEditor.ts says so if it's missing)
 *   - one whose row differs: update it, unless someone answered (or it's
 *     open): then only a changed prompt goes through (a typo fix), never a
 *     new kind or options, so the answers stay what they were
 *   - an activity slide with no `activity` (an agenda from before the
 *     editor, its row seeded by script): its row is left alone
 *   - a row whose slide is gone, or isn't an activity slide any more:
 *     deleted when nobody answered and it isn't open, else kept
 */
export function planActivities(agenda: Segment[], rows: ActivityRowLite[], answers: Record<string, number> = {}): ActivityPlan {
  const plan: ActivityPlan = { insert: [], update: [], remove: [], kept: [], incomplete: [] }
  const bySlide = new Map(rows.map(r => [r.segment_id, r]))
  const slides = new Set<string>()
  for (const s of agenda) {
    if (!isActivitySlide(s)) continue
    slides.add(s.id)
    if (!s.activity) continue
    const want = activityComplete(s.activity)
    if (!want) {
      plan.incomplete.push(s.id)
      continue
    }
    const row = bySlide.get(s.id)
    if (!row) {
      plan.insert.push({ segment_id: s.id, ...want })
      continue
    }
    const sameShape = row.kind === want.kind && stable(optionsOf(row.options)) === stable(want.options) && stable(row.config ?? {}) === stable(want.config)
    const samePrompt = row.prompt === want.prompt
    if (sameShape && samePrompt) continue
    const answered = (answers[row.id] ?? 0) > 0 || row.status === 'open'
    if (!answered) plan.update.push({ id: row.id, patch: want })
    else {
      if (!samePrompt) plan.update.push({ id: row.id, patch: { prompt: want.prompt } })
      if (!sameShape) plan.kept.push(s.id)
    }
  }
  for (const r of rows) {
    if (slides.has(r.segment_id)) continue
    if ((answers[r.id] ?? 0) > 0 || r.status === 'open') plan.kept.push(r.segment_id)
    else plan.remove.push(r.id)
  }
  return plan
}

/**
 * The agenda with each activity slide's activity filled from its row where
 * the slide has none (an agenda from before the editor): what the editor
 * starts from, so the question and options show and can be edited.
 */
export function withActivities(agenda: Segment[], rows: Pick<ActivityRowLite, 'segment_id' | 'kind' | 'prompt' | 'options' | 'config'>[]): Segment[] {
  const bySlide = new Map(rows.map(r => [r.segment_id, r]))
  return agenda.map(s => {
    if (s.activity) return s
    const row = bySlide.get(s.id)
    if (!row || (s.slide && s.slide !== 'activity')) return s
    const config = row.config && typeof row.config === 'object' && !Array.isArray(row.config) ? (row.config as Record<string, unknown>) : {}
    const activity: SlideActivity = {
      kind: row.kind,
      prompt: row.prompt,
      ...(hasOptions(row.kind) ? { options: optionsOf(row.options) } : {}),
      ...(Object.keys(config).length ? { config } : {}),
    }
    return { ...s, activity }
  })
}

/**
 * Rehearsal's activities (the solo preview), keyed by slide: each activity
 * slide's own `activity` (so an edit shows at once, before any row exists),
 * else its stored row's (`stored`, from the server). Ready, no answers: the
 * preview fills them with sample answers (lib/meet/rehearse.ts).
 */
export function rehearsalActivities(agenda: Segment[], stored: Record<string, PublicActivity> = {}): Record<string, PublicActivity> {
  const out: Record<string, PublicActivity> = {}
  for (const s of agenda) {
    const row = stored[s.id]
    if (s.activity && isActivitySlide(s)) {
      const a = s.activity
      out[s.id] = {
        id: row?.id ?? `local:${s.id}`,
        segmentId: s.id,
        kind: a.kind,
        prompt: a.prompt || 'Your question',
        options: a.kind === 'predict' ? (a.options ?? []).slice(0, 4) : a.kind === 'poll' ? (a.options ?? []).filter(o => o.trim()).slice(0, 4) : [],
        config: a.config ?? row?.config ?? {},
        status: 'ready',
        openedAt: null,
        closedAt: null,
        closesAt: null,
        answered: 0,
        total: 0,
        counts: null,
        words: null,
        tally: null,
      }
    } else if (row) out[s.id] = row
  }
  return out
}
