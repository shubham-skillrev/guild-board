#!/usr/bin/env node
/**
 * Load a written agenda (docs/agendas/YYYY-MM.json, see
 * docs/07-agenda-and-script-guide.md) into the month's `meetings.agenda`,
 * exactly as the Run tab stores it (lib/guild/meeting.ts mergeAgenda):
 *
 *   { id, kind, slide, section, of?, duration_s?, meme?, title, detail, minutes: 0,
 *     topicIds, cue?, cards?, prep: { points, opener, by: 'admin', at, ask } | null }
 *
 * One item per slide (docs/06-meeting-mode.md, "Slides"): `slide` is title /
 * content / activity / results / text / meme, `section` groups consecutive
 * slides, a results slide's `of` names its activity slide. `cue` is the one
 * line on the shared screen, `cards` the slide's content (news and post as
 * cards, side and note as plain text, docs/07); `prep` is the presenter's
 * notes, which only reach the presenter. Every activity slide needs exactly
 * one entry in the file's `activities` (its `segment` is the slide's id).
 * An old file of segments (no `slide`) still loads.
 *
 * `by: 'admin'` so Kers never redrafts over it. `ask` ("who to ask") is
 * worked out here, never kept in the file: the members who voted on or
 * commented on the segment's posts, ghost comments and system accounts left
 * out, at most 20 (the rule in lib/guild/meetingPrep.ts).
 *
 *   node --env-file=.env.local scripts/apply-agenda.mjs docs/agendas/2026-11.json [--cycle <uuid>] [--apply] [--force]
 *
 * A dry run by default: it checks the file and prints what it would store.
 * --apply writes it. Refuses when the file's month isn't the cycle's (unless
 * --force), when a segment points at a post outside that month, or once the
 * meeting has started. The activities are seeded separately:
 *   node --env-file=.env.local scripts/seed-meeting-activities.mjs --from <file>
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY).
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

// Mirrors lib/meeting.ts.
const LIMITS = { title: 80, detail: 400, point: 200, opener: 240, points: 3, topics: 3, segments: 40, cue: 120, cards: 6, cardTitle: 120, cardText: 180, source: 60, label: 40, url: 500, section: 40, memeText: 90 }
const SLIDES = ['title', 'content', 'activity', 'results', 'text', 'meme']
const FACES = ['smug', 'proud', 'dramatic', 'excited', 'bored', 'nosy', 'sleepy', 'grumpy', 'relieved', 'lonely']
const KINDS = ['warmup', 'radar', 'showtell', 'topic', 'clinic', 'boss', 'wrap', 'custom']
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const ASK_MAX = 20

const args = process.argv.slice(2)
const file = args.find(a => !a.startsWith('--') && args[args.indexOf(a) - 1] !== '--cycle')
const apply = args.includes('--apply')
const force = args.includes('--force')
const cycleArg = args.includes('--cycle') ? args[args.indexOf('--cycle') + 1] : null
if (!file) {
  console.error('Usage: scripts/apply-agenda.mjs <agenda.json> [--cycle <uuid>] [--apply] [--force]')
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
if (!url || !key) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (try --env-file=.env.local).')
  process.exit(1)
}
const db = createClient(url, key, { auth: { persistSession: false } })

/** Every way the file breaks the shape lib/meeting.ts cleanAgenda would silently cut. */
function check(agenda, activities = []) {
  const errors = []
  if (!Array.isArray(agenda) || !agenda.length) return ['`agenda` must be a non-empty array']
  if (agenda.length > LIMITS.segments) errors.push(`more than ${LIMITS.segments} slides`)
  const ids = new Set()
  const slides = agenda.some(s => s.slide !== undefined)
  for (const s of agenda) {
    const at = `slide "${s.id}"`
    if (slides) {
      if (!SLIDES.includes(s.slide)) errors.push(`${at}: slide must be ${SLIDES.join(' / ')}`)
      if (typeof s.section !== 'string' || !s.section || s.section.length > LIMITS.section) errors.push(`${at}: section must be 1-${LIMITS.section} characters`)
      if (s.slide === 'results') {
        const target = agenda.find(x => x.id === s.of)
        if (!target || target.slide !== 'activity') errors.push(`${at}: of must name an activity slide`)
      }
      if (s.slide === 'activity' && activities.filter(a => a.segment === s.id).length !== 1) errors.push(`${at}: needs exactly one entry in activities`)
      if (s.duration_s !== undefined && (s.slide !== 'activity' || !Number.isInteger(s.duration_s) || s.duration_s < 10 || s.duration_s > 1800)) errors.push(`${at}: duration_s is an activity slide's countdown, 10-1800 seconds`)
      if (s.slide === 'meme') errors.push(...checkMeme(s.meme).map(e => `${at} meme: ${e}`))
      else if (!s.title) errors.push(`${at}: title is required`)
    }
    if (typeof s.id !== 'string' || !s.id || s.id.length > 40) errors.push(`${at}: id must be 1-40 characters`)
    if (ids.has(s.id)) errors.push(`${at}: duplicate id`)
    ids.add(s.id)
    if (!KINDS.includes(s.kind)) errors.push(`${at}: unknown kind ${s.kind}`)
    if ((!slides && !s.title) || (s.title ?? '').length > LIMITS.title) errors.push(`${at}: title must be up to ${LIMITS.title} characters`)
    if ((s.detail ?? '').length > LIMITS.detail) errors.push(`${at}: detail over ${LIMITS.detail} characters`)
    if (!Number.isInteger(s.minutes) || s.minutes < (slides ? 0 : 1) || s.minutes > 60) errors.push(`${at}: minutes must be ${slides ? 0 : 1}-60`)
    const topics = s.topicIds ?? []
    if (topics.length > LIMITS.topics || topics.some(t => !UUID.test(t))) errors.push(`${at}: topicIds must be up to ${LIMITS.topics} post ids`)
    if (s.cue !== undefined && (typeof s.cue !== 'string' || s.cue.length > LIMITS.cue)) errors.push(`${at}: cue must be a string up to ${LIMITS.cue} characters`)
    if (s.cards !== undefined) {
      if (!Array.isArray(s.cards) || s.cards.length > LIMITS.cards) errors.push(`${at}: up to ${LIMITS.cards} cards`)
      for (const [i, c] of (Array.isArray(s.cards) ? s.cards : []).entries()) errors.push(...checkCard(c).map(e => `${at} card ${i + 1}: ${e}`))
    }
    const p = s.prep
    if (p) {
      if (!Array.isArray(p.points) || p.points.length > LIMITS.points) errors.push(`${at}: up to ${LIMITS.points} points`)
      for (const pt of p.points ?? []) if (typeof pt !== 'string' || pt.length > LIMITS.point) errors.push(`${at}: a point over ${LIMITS.point} characters`)
      if (typeof p.opener !== 'string' || p.opener.length > LIMITS.opener) errors.push(`${at}: opener over ${LIMITS.opener} characters`)
      if (p.ask?.length) errors.push(`${at}: keep ask empty in the file, it's computed here`)
    }
  }
  return errors
}

/** One card against lib/meeting.ts cleanCard: what it would drop or cut, as errors. */
function checkCard(c) {
  const errs = []
  const text = (v, max, name, required) => {
    if (v === undefined || v === '') { if (required) errs.push(`${name} is required`); return }
    if (typeof v !== 'string' || v.length > max) errs.push(`${name} must be a string up to ${max} characters`)
  }
  switch (c?.kind) {
    case 'news':
      text(c.title, LIMITS.cardTitle, 'title', true)
      text(c.source, LIMITS.source, 'source')
      text(c.why, LIMITS.cardText, 'why')
      if (c.url !== undefined && !(typeof c.url === 'string' && /^https?:\/\/\S+$/i.test(c.url) && c.url.length <= LIMITS.url)) errs.push('url must be an http(s) link')
      if (c.from !== undefined && !['member', 'digest'].includes(c.from)) errs.push('from must be member or digest')
      break
    case 'post':
      if (!UUID.test(c.postId ?? '')) errs.push('postId must be a post id')
      break
    case 'side':
      text(c.label, LIMITS.label, 'label', true)
      text(c.text, LIMITS.cardText, 'text', true)
      break
    case 'note':
      text(c.title, LIMITS.cardTitle, 'title', true)
      text(c.text, LIMITS.cardText, 'text')
      break
    default:
      errs.push(`unknown kind ${c?.kind}`)
  }
  return errs
}

/** A meme against lib/meeting.ts cleanMeme: an image under /meet/memes/, or 1-2 Kers panels. */
function checkMeme(m) {
  if (!m || typeof m !== 'object') return ['missing']
  const errs = []
  if (m.src !== undefined && !/^\/meet\/memes\/[\w.\-]+\.(png|jpe?g|gif|webp|svg)$/i.test(m.src)) errs.push('src must be /meet/memes/<file>.png|jpg|gif|webp|svg')
  if (m.src && !m.alt) errs.push('an image needs alt text')
  const panels = m.panels ?? []
  if (!m.src && !panels.length && !m.caption) errs.push('needs src, panels or a caption')
  if (panels.length > 2) errs.push('at most 2 panels')
  for (const p of panels) {
    if (!p.text || p.text.length > LIMITS.memeText) errs.push(`panel text must be 1-${LIMITS.memeText} characters`)
    if ((p.label ?? '').length > LIMITS.label) errs.push(`panel label over ${LIMITS.label}`)
    if (!FACES.includes(p.face)) errs.push(`face must be ${FACES.join(' / ')}`)
  }
  if ((m.caption ?? '').length > LIMITS.memeText) errs.push(`caption over ${LIMITS.memeText}`)
  return errs
}

async function main() {
  const ref = JSON.parse(readFileSync(file, 'utf8'))
  const errors = check(ref.agenda, ref.activities ?? [])
  if (errors.length) throw new Error(`${file} doesn't fit the agenda shape:\n  ${errors.join('\n  ')}`)

  const cycle = cycleArg
    ? (await db.from('cycles').select('id, label').eq('id', cycleArg).maybeSingle()).data
    : (await db.from('cycles').select('id, label').in('status', ['open', 'frozen']).order('year', { ascending: false }).order('month', { ascending: false }).limit(1).maybeSingle()).data
  if (!cycle) throw new Error('No such month (pass --cycle <uuid>).')
  if (ref.cycle && ref.cycle !== cycle.label && !force) throw new Error(`${file} is for ${ref.cycle}, the cycle is ${cycle.label} (--force to load it anyway).`)

  const { data: meeting, error: mErr } = await db.from('meetings').select('agenda, started_at, ended_at').eq('cycle_id', cycle.id).maybeSingle()
  if (mErr) throw mErr
  if (meeting?.started_at && !meeting?.ended_at) throw new Error(`${cycle.label}'s meeting has started: change it in the Run tab instead.`)

  // The posts must be this month's, and not deleted.
  const topicIds = [...new Set(ref.agenda.flatMap(s => [...(s.topicIds ?? []), ...(s.cards ?? []).filter(c => c.kind === 'post').map(c => c.postId)]))]
  const posts = new Map()
  if (topicIds.length) {
    const { data, error } = await db.from('topics').select('id, title').in('id', topicIds).eq('cycle_id', cycle.id).eq('is_deleted', false)
    if (error) throw error
    for (const t of data) posts.set(t.id, t.title)
    const missing = topicIds.filter(id => !posts.has(id))
    if (missing.length) throw new Error(`Not posts in ${cycle.label}: ${missing.join(', ')}`)
  }

  // Who to ask, per post: voters and named commenters, minus system accounts.
  const people = new Map()
  if (topicIds.length) {
    const [{ data: votes, error: vErr }, { data: comments, error: cErr }] = await Promise.all([
      db.from('votes').select('topic_id, user_id').in('topic_id', topicIds),
      db.from('comments').select('topic_id, user_id, is_anonymous').in('topic_id', topicIds).eq('is_deleted', false),
    ])
    if (vErr || cErr) throw vErr || cErr
    const add = (t, u) => {
      if (!u) return
      if (!people.has(t)) people.set(t, new Set())
      people.get(t).add(u)
    }
    for (const v of votes) add(v.topic_id, v.user_id)
    for (const c of comments) if (!c.is_anonymous) add(c.topic_id, c.user_id)
    const everyone = [...new Set([...people.values()].flatMap(s => [...s]))]
    if (everyone.length) {
      const { data: system } = await db.from('users').select('id').in('id', everyone).eq('is_system', true)
      for (const u of system ?? []) for (const set of people.values()) set.delete(u.id)
    }
  }

  const at = new Date().toISOString()
  const agenda = ref.agenda.map(s => {
    const ids = s.topicIds ?? []
    const ask = [...new Set(ids.flatMap(id => [...(people.get(id) ?? [])]))].slice(0, ASK_MAX)
    return {
      id: s.id,
      kind: s.kind,
      ...(s.slide ? { slide: s.slide, section: s.section } : {}),
      ...(s.of ? { of: s.of } : {}),
      ...(s.duration_s ? { duration_s: s.duration_s } : {}),
      ...(s.meme ? { meme: s.meme } : {}),
      title: (s.title ?? '').trim(),
      detail: (s.detail ?? '').trim(),
      minutes: s.minutes,
      topicIds: ids,
      ...(s.cue ? { cue: s.cue.trim() } : {}),
      ...(s.cards ? { cards: s.cards } : {}),
      prep: s.prep ? { points: s.prep.points.map(p => p.trim()), opener: s.prep.opener.trim(), by: 'admin', at, ask } : null,
    }
  })

  const total = agenda.reduce((n, s) => n + s.minutes, 0)
  const sections = [...new Set(agenda.map(s => s.section ?? s.id))]
  console.log(`${cycle.label} (${cycle.id}): ${agenda.length} slides in ${sections.length} sections${total ? `, ${total} min` : ''}${apply ? '' : ' (dry run: --apply to write)'}`)
  const acts = new Map((ref.activities ?? []).map(a => [a.segment, a]))
  for (const [i, s] of agenda.entries()) {
    console.log(`  ${String(i + 1).padStart(2)}  ${(s.slide ?? 'segment').padEnd(8)} ${(s.section ?? s.kind).padEnd(16)} ${s.id.padEnd(15)} ${s.title || (s.meme?.panels ?? []).map(p => p.text).join(' / ') || s.meme?.caption || ''}`)
    if (acts.has(s.id)) console.log(`             ${acts.get(s.id).kind}: ${acts.get(s.id).prompt}${acts.get(s.id).options?.length ? ` [${acts.get(s.id).options.join(' / ')}]` : ''}`)
    if (s.of) console.log(`             results of: ${s.of}`)
    for (const id of s.topicIds) console.log(`             post: ${posts.get(id)}`)
    if (s.cue) console.log(`             cue: ${s.cue}`)
    for (const c of s.cards ?? []) console.log(`             card ${c.kind}: ${c.kind === 'post' ? posts.get(c.postId) : c.title ?? c.label}`)
    if (s.prep) console.log(`             opener: ${s.prep.opener}\n             ${s.prep.points.length} points, ask ${s.prep.ask.length}`)
  }
  const before = Array.isArray(meeting?.agenda) ? meeting.agenda : []
  const edited = before.filter(s => s?.prep?.by === 'admin').map(s => s.id)
  if (before.length) console.log(`  replaces the stored agenda (${before.length} segments: ${before.map(s => s.id).join(', ')})`)
  if (edited.length) console.log(`  overwrites admin-edited prep on: ${edited.join(', ')}`)

  if (!apply) return
  const { error } = await db.from('meetings').upsert({ cycle_id: cycle.id, agenda, updated_at: at })
  if (error) throw error
  console.log(`Stored. Now seed its activities:\n  node --env-file=.env.local scripts/seed-meeting-activities.mjs --from ${file}`)
}

main().catch(err => {
  console.error(err.message ?? err)
  process.exit(1)
})
