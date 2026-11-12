#!/usr/bin/env node
/**
 * Seed the first run's meeting activities (docs/06-meeting-mode.md, "First-run
 * agenda") into `meeting_activities` (migration 046). There's no UI for this
 * on purpose: the activities are hard-coded for the first run.
 *
 *   node --env-file=.env.local scripts/seed-meeting-activities.mjs [--cycle <uuid>] [--from <agenda.json>] [--dry]
 *
 * --from takes a month's reference file (docs/agendas/YYYY-MM.json, loaded
 * with scripts/apply-agenda.mjs) and seeds its `activities` instead of the
 * first-run list below. Each names its activity slide by id (`segment`), and
 * is stored under that id (meeting_activities.segment_id), one per slide,
 * which is what UNIQUE(cycle_id, segment_id) allows: arriving on the slide
 * opens it (docs/06-meeting-mode.md, "Slides"). Matched by id first; by the
 * section's kind only as a fallback, and then only to an activity slide (or
 * an old segment), never to a title, meme or results slide.
 *
 * Needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or
 * SUPABASE_SECRET_KEY). Defaults to the open month's meeting.
 *
 * Without --from, segments are found by KIND, not id: the first activity
 * slide (or old segment) of each kind below gets its activity, so it works on an agenda drafted by "Build from
 * the board" (stable ids warmup / radar / topic / clinic / boss) and on one
 * edited by hand. A kind missing from the agenda is reported and skipped:
 * add the segment in the Run tab, save, and run this again.
 *
 * Safe to re-run: an activity still `ready` is updated in place; one that has
 * been opened is left alone (its answers stay). `ready` activities whose
 * segment is no longer on the agenda are removed.
 */
import { readFileSync } from 'node:fs'
import { createClient } from '@supabase/supabase-js'

const FIRST_RUN = [
  { kind: 'warmup', activity: 'cloud', prompt: 'One word for your week so far' },
  {
    kind: 'radar',
    activity: 'poll',
    prompt: 'Would you send production code to a hosted AI model?',
    options: ['Yes, freely', 'Only with an enterprise contract', 'Only self-hosted', 'Never'],
  },
  {
    kind: 'topic',
    activity: 'poll',
    prompt: 'AI by 2028?',
    options: ['💥 Bursts', '📉 Slow deflate', '🚀 Still booming', '🤷 Tech stays, business crashes'],
  },
  { kind: 'clinic', activity: 'cloud', prompt: 'One word: your biggest blocker this month' },
  // Phase 3 renders it; seeded now so the segment has its activity.
  { kind: 'boss', activity: 'boss', prompt: 'Sum of the even numbers', config: { problem: 1 } },
]

const args = process.argv.slice(2)
const dry = args.includes('--dry')
const cycleArg = args.includes('--cycle') ? args[args.indexOf('--cycle') + 1] : null
const fromArg = args.includes('--from') ? args[args.indexOf('--from') + 1] : null

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY
if (!url || !key) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (try --env-file=.env.local).')
  process.exit(1)
}
const db = createClient(url, key, { auth: { persistSession: false } })

async function main() {
  let cycle
  if (cycleArg) {
    cycle = (await db.from('cycles').select('id, label').eq('id', cycleArg).maybeSingle()).data
  } else {
    cycle = (await db.from('cycles').select('id, label').in('status', ['open', 'frozen']).order('year', { ascending: false }).order('month', { ascending: false }).limit(1).maybeSingle()).data
  }
  if (!cycle) throw new Error('No such month (pass --cycle <uuid>).')

  const { data: meeting, error: mErr } = await db.from('meetings').select('agenda').eq('cycle_id', cycle.id).maybeSingle()
  if (mErr) throw mErr
  if (!meeting) throw new Error(`${cycle.label} has no meeting yet: save an agenda in the Run tab first.`)
  const agenda = Array.isArray(meeting.agenda) ? meeting.agenda : []

  const { data: existing, error: aErr } = await db.from('meeting_activities').select('id, segment_id, status').eq('cycle_id', cycle.id)
  if (aErr) throw new Error(`${aErr.message} (is migration 046 applied?)`)
  const bySegment = new Map(existing.map(a => [a.segment_id, a]))

  let items = FIRST_RUN
  if (fromArg) {
    const file = JSON.parse(readFileSync(fromArg, 'utf8'))
    const kindOf = new Map((file.agenda ?? []).map(s => [s.id, s.kind]))
    items = (file.activities ?? []).map(a => ({ segment: a.segment, kind: kindOf.get(a.segment) ?? a.segment, activity: a.kind, prompt: a.prompt, options: a.options, config: a.config }))
  }

  console.log(`${cycle.label}: ${agenda.length} slides${dry ? ' (dry run)' : ''}${fromArg ? `, activities from ${fromArg}` : ''}`)
  const targeted = new Set()
  for (const item of items) {
    // An activity lives on an activity slide (or an old segment without `slide`).
    const fits = s => !s.slide || s.slide === 'activity'
    const seg = (item.segment && agenda.find(s => s.id === item.segment && fits(s))) || agenda.find(s => s.kind === item.kind && fits(s))
    if (!seg) {
      console.log(`  skip  ${item.segment ?? item.kind}: no activity slide for it on the stored agenda (apply the agenda first)`)
      continue
    }
    targeted.add(seg.id)
    const row = {
      cycle_id: cycle.id,
      segment_id: seg.id,
      kind: item.activity,
      prompt: item.prompt,
      options: item.options ?? [],
      config: item.config ?? {},
    }
    const had = bySegment.get(seg.id)
    if (had && had.status !== 'ready') {
      console.log(`  keep  ${item.kind} → ${seg.id}: already ${had.status}`)
      continue
    }
    console.log(`  ${had ? 'update' : 'add   '} ${item.kind} → ${seg.id}: ${item.activity} "${item.prompt}"`)
    if (dry) continue
    const { error } = had
      ? await db.from('meeting_activities').update(row).eq('id', had.id)
      : await db.from('meeting_activities').insert({ ...row, status: 'ready' })
    if (error) throw error
  }

  const ids = new Set(agenda.map(s => s.id))
  for (const a of existing) {
    if (a.status === 'ready' && !ids.has(a.segment_id) && !targeted.has(a.segment_id)) {
      console.log(`  drop  ${a.segment_id}: no longer on the agenda`)
      if (!dry) {
        const { error } = await db.from('meeting_activities').delete().eq('id', a.id)
        if (error) throw error
      }
    }
  }
  console.log('Done.')
}

main().catch(err => {
  console.error(err.message ?? err)
  process.exit(1)
})
