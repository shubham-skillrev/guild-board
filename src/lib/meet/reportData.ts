import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { openCycle } from '@/lib/guild/demos'
import { getMeeting } from '@/lib/guild/meeting'
import { rehearsalOn } from '@/lib/meet/liveRehearsal'
import { meetingReport, type MeetingReport } from '@/lib/meet/report'
import type { ActivityRow } from '@/lib/meet/activity'

export type ReportLoad =
  | { ok: true; report: MeetingReport; cycle: { id: string; label: string } }
  | { ok: false; status: number; error: string }

/**
 * A month's post-meeting report (lib/meet/report.ts), for
 * GET /api/admin/meeting/report and its image. Read-only: SELECTs only.
 * Only the participant's user_id is read (member or guest), never a name.
 * Refused while a live rehearsal runs: its answers aren't the meeting.
 */
export async function loadMeetingReport(cycleId: string | null): Promise<ReportLoad> {
  const admin = createAdminClient()
  const cycle = cycleId ? (await admin.from('cycles').select('id, label, meeting_at').eq('id', cycleId).maybeSingle()).data : await openCycle(admin)
  if (!cycle) return { ok: false, status: 404, error: 'No such month' }
  const meeting = await getMeeting(cycle.id)
  if (rehearsalOn(meeting)) return { ok: false, status: 409, error: 'A rehearsal is running: its answers aren’t a report. End it first.' }

  const [people, acts] = await Promise.all([
    admin.from('meeting_participants').select('user_id').eq('cycle_id', cycle.id),
    admin.from('meeting_activities').select('*').eq('cycle_id', cycle.id),
  ])
  const activities = (acts.data ?? []) as ActivityRow[]
  const ids = activities.map(a => a.id)
  const responses = ids.length ? (await admin.from('meeting_responses').select('activity_id, participant_id, slot, value').in('activity_id', ids)).data ?? [] : []

  const report = meetingReport({
    label: cycle.label,
    meetingAt: meeting.startedAt ?? cycle.meeting_at ?? null,
    agenda: meeting.agenda,
    participants: (people.data ?? []) as { user_id: string | null }[],
    activities,
    responses: responses as { activity_id: string; participant_id: string; slot: number; value: unknown }[],
  })
  return { ok: true, report, cycle: { id: cycle.id, label: cycle.label } }
}
