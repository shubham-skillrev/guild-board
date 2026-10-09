// ROUTE: GET /api/cron/autopilot
// AUTH: shared secret via Authorization: Bearer $CRON_SECRET (NOT a user session)
// PURPOSE: Runs the month without an admin. Daily, ~09:00 IST:
//            A. the day after the meeting, close that cycle (sparks get 48h)
//            B. if no cycle is open, open next month: 2nd Friday 11:00 IST,
//               a theme from the catalog, Slack + push
//            C. Bytes: 10 stories ~15 days before the meeting, 10 more ~3 days
//               before, each announced
//          ?dry=1 reports what it would do without writing or notifying;
//          add &now=<ISO> to ask about another day.
//          AUTOPILOT_DISABLED=1 turns the whole thing off.
// DB TABLES: cycles, byte_digests, bytes, users, push_subscriptions
// RLS: service-role client (no user context exists here)

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rejectIfNotCron, firstAdminId } from '@/lib/bytes/cron'
import { generateDigest } from '@/lib/bytes/generate'
import { closeCycle, createCycle } from '@/lib/cycles/lifecycle'
import { cycleLabel, defaultMeetingAt, istDate, istDaysBetween, MONTH_NAMES, nextMonth } from '@/lib/cycles/dates'
import { pickNextTheme } from '@/lib/themes/catalog'
import { sanitizeTheme } from '@/lib/themes'
import { notifyOnBytesPublished, notifyOnCycleEnded, notifyOnCycleOpen } from '@/lib/push/notify'
import type { Cycle } from '@/types'

/* Every step decides from what is stored, never from the clock alone: the
   schedule fires somewhere inside its hour, a day can be skipped, and a
   retried run must not close, open or publish twice. */

/** The two Bytes drops: days before the meeting, and how far back each looks. */
const DROPS = [
  { part: 1, daysBefore: 15, lookback: 18 },
  { part: 2, daysBefore: 3, lookback: 13 },
] as const
const BYTES_PER_DROP = 10

// Fetching feeds, curating and summarising can exceed the default limit.
export const maxDuration = 300

type Step = { step: string; done: boolean; detail: string }

export async function GET(request: Request) {
  const rejected = rejectIfNotCron(request)
  if (rejected) return rejected

  if (process.env.AUTOPILOT_DISABLED === '1') {
    return NextResponse.json({ skipped: true, reason: 'disabled', message: 'AUTOPILOT_DISABLED=1' })
  }

  const params = new URL(request.url).searchParams
  const dry = params.get('dry') === '1'
  const admin = createAdminClient()
  // A dry run can pretend it is another day (?now=2026-10-10T04:00:00Z), to
  // check what the schedule will do. Never honoured on a real run.
  const asOf = dry && params.get('now') ? new Date(params.get('now')!) : null
  const now = asOf && !Number.isNaN(asOf.getTime()) ? asOf : new Date()
  const steps: Step[] = []

  const newestOpen = async () =>
    (await admin
      .from('cycles')
      .select('*')
      .eq('status', 'open')
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(1)
      .maybeSingle()).data as Cycle | null

  /* ─── A. Close the month whose meeting was yesterday or earlier ─── */
  try {
    const open = await newestOpen()
    const meeting = open?.meeting_at ? new Date(open.meeting_at) : null
    // A cycle with no meeting date is the admin's to close.
    if (open && meeting && istDate(now) > istDate(meeting)) {
      if (!dry) {
        const closed = await closeCycle(admin, open.id)
        await notifyOnCycleEnded({ label: closed.label })
      }
      steps.push({ step: 'close', done: !dry, detail: `${open.label}: meeting was ${istDate(meeting)}` })
    }
  } catch (err) {
    steps.push({ step: 'close', done: false, detail: errorText(err) })
  }

  /* ─── B. Open next month when nothing is open ─── */
  try {
    const { data: live } = await admin
      .from('cycles')
      .select('id')
      .in('status', ['open', 'upcoming'])
      .limit(1)
    // In a dry run step A did not actually close anything, so judge as if it had.
    const closedInDry = dry && steps.some(s => s.step === 'close')
    if (!live?.length || closedInDry) {
      const { data: history } = await admin
        .from('cycles')
        .select('year, month, theme')
        .order('year', { ascending: false })
        .order('month', { ascending: false })
        .limit(120)

      const { year, month } = monthToOpen(history?.[0] ?? null, now)
      const label = cycleLabel(year, month)
      const meetingAt = defaultMeetingAt(year, month).toISOString()
      const theme = pickNextTheme(
        (history ?? []).flatMap(c => {
          const t = sanitizeTheme(c.theme)
          return t ? [{ id: t.id, featured_kind: t.featured_kind }] : []
        }),
      )

      if (!dry) {
        const result = await createCycle(admin, { year, month, label, meetingAt, theme })
        if (!result.ok) throw new Error(result.message)
        await notifyOnCycleOpen({ label: result.cycle.label, theme })
      }
      steps.push({ step: 'open', done: !dry, detail: `${label}, meeting ${istDate(new Date(meetingAt))}, theme "${theme.name}" (${theme.id})` })
    }
  } catch (err) {
    steps.push({ step: 'open', done: false, detail: errorText(err) })
  }

  /* ─── C. Bytes, timed to the meeting ─── */
  try {
    const open = await newestOpen()
    const meeting = open?.meeting_at ? new Date(open.meeting_at) : null
    const daysLeft = meeting ? istDaysBetween(now, meeting) : null

    if (open && meeting && daysLeft !== null && daysLeft >= 0) {
      // The latest drop that is due. If drop 1 was missed and drop 2 is due,
      // drop 2 runs alone rather than two digests landing back to back.
      const drop = [...DROPS].reverse().find(d => daysLeft <= d.daysBefore)
      if (drop) {
        const periodStart = istDate(new Date(meeting.getTime() - drop.daysBefore * 86_400_000))
        const label = `${MONTH_NAMES[open.month - 1]} meet · Part ${drop.part}`
        const { data: existing } = await admin
          .from('byte_digests')
          .select('id')
          .eq('kind', 'weekly')
          .eq('period_start', periodStart)
          .maybeSingle()

        if (!existing) {
          if (dry) {
            steps.push({ step: 'bytes', done: false, detail: `${label}: ${BYTES_PER_DROP} stories from the last ${drop.lookback} days` })
          } else {
            const owner = await firstAdminId()
            if (!owner) throw new Error('No admin user to attribute the digest to')
            const result = await generateDigest({
              kind: 'weekly',
              periodStart,
              cycleId: open.id,
              label,
              days: drop.lookback,
              limit: BYTES_PER_DROP,
              createdBy: owner,
            })
            if (!result.ok) {
              steps.push({ step: 'bytes', done: false, detail: `${label}: ${result.reason} (${result.message})` })
            } else {
              await notifyOnBytesPublished({ digestId: result.digestId, label: result.label, count: result.count, mix: result.mix })
              steps.push({ step: 'bytes', done: true, detail: `${label}: ${result.count} stories` })
            }
          }
        }
      }
    }
  } catch (err) {
    steps.push({ step: 'bytes', done: false, detail: errorText(err) })
  }

  for (const s of steps) if (!s.done && !dry) console.warn('cron/autopilot:', s.step, s.detail)
  return NextResponse.json({ dry, today: istDate(now), steps: steps.length ? steps : 'nothing to do today' })
}

/**
 * The month after the latest cycle, but never one already behind us: if the
 * guild sat idle for a while, start from the current month, and if that
 * month's meeting has already passed, the one after.
 */
function monthToOpen(latest: { year: number; month: number } | null, now: Date) {
  const [y, m] = istDate(now).split('-').map(Number)
  let next = latest ? nextMonth(latest.year, latest.month) : { year: y, month: m }
  if (next.year < y || (next.year === y && next.month < m)) next = { year: y, month: m }
  if (defaultMeetingAt(next.year, next.month) <= now) next = nextMonth(next.year, next.month)
  return next
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}
