// ROUTE: POST /api/admin/meeting  { action, cycle_id, ... }
//        GET  /api/admin/meeting[?cycle_id=][&prep=1]  -> MeetingState (the open month by default;
//             prep=1 also drafts missing prep when inside the 3 h before the meeting)
// AUTH: admin only (404 for everyone else)
// PURPOSE: Everything about the month's meeting (migrations 041, 045):
//            save          { meet_url?, agenda?, recording_url?, recap? }
//                          (agenda items may carry topicIds and prep)
//            draft_agenda  -> { agenda } built from the format (not saved)
//            post_agenda   the saved agenda to the guild's Slack channel; this
//                          locks it, so Kers drafts any missing prep after
//            draft_prep    { segment? } Kers' prep now: every segment still
//                          missing one, or just `segment` (over an edit too)
//            start         meeting mode on: live, and the caller presents
//                          (unless another admin already is)
//            take_over     the caller presents from now on
//            goto          { segment } the presenter moves the shared screen;
//                          an open activity closes
//            end           meeting mode off: closes any open activity and
//                          expires every guest's token
//            open_activity { activity_id } the presenter opens the segment's
//                          poll or word cloud (closing any other)
//            close_activity { activity_id } closes it (moving on does too)
//            note          { note: { text, owner?, decision?, segment? } }
//            delete_note   { id }
//            draft_recap   -> { recap, byAi } from what was captured (not saved)
//            post_recap    the saved recap to Slack
// DB TABLES: meetings, cycles, topics, demos, radar_links, bytes,
//            meeting_activities, meeting_participants, meeting_responses (046)

import { after, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminId } from '@/lib/guild/staff'
import { agendaMessage, draftAgenda, draftRecap, getMeeting, mergeAgenda, missing045, openCycle, recapMessage, saveMeeting } from '@/lib/guild/meeting'
import { draftPrep, ensurePrepBeforeMeeting } from '@/lib/guild/meetingPrep'
import { cleanNote, LIMITS, type MeetingState } from '@/lib/meeting'
import { closeActivity, closeOpenActivities, closeRoom, nudgeRoom, openActivity, readRoom } from '@/lib/meet/room'
import { isSlackConfigured, postToSlack } from '@/lib/slack/send'

export const maxDuration = 120

function httpsOrNull(v: unknown): string | null | undefined {
  if (v === undefined) return undefined
  if (v === null || v === '') return null
  try {
    const u = new URL(String(v).trim())
    return u.protocol === 'https:' && u.href.length <= 500 ? u.toString() : undefined
  } catch {
    return undefined
  }
}

async function presenterName(id: string | null): Promise<string | null> {
  if (!id) return null
  const { data } = await createAdminClient().from('users').select('username').eq('id', id).maybeSingle()
  return data?.username ?? null
}

async function state(cycle: MeetingState['cycle'], me: string): Promise<MeetingState> {
  const meeting = await getMeeting(cycle.id)
  const [name, room] = await Promise.all([presenterName(meeting.presenterId), readRoom(createAdminClient(), cycle.id).catch(() => null)])
  return { cycle, meeting, me, presenterName: name, serverNow: new Date().toISOString(), room }
}

export async function GET(request: Request) {
  const adminId = await getAdminId()
  if (!adminId) return new NextResponse(null, { status: 404 })
  const params = new URL(request.url).searchParams
  const id = params.get('cycle_id')
  const admin = createAdminClient()
  const cycle = id ? (await admin.from('cycles').select('id, label, meeting_at').eq('id', id).maybeSingle()).data : await openCycle(admin)
  if (!cycle) return NextResponse.json({ error: 'No such month' }, { status: 404 })
  const s = await state(cycle, adminId)
  // Kers' prep at the latest: an admin's board loading inside the 3 h before
  // (?prep=1, sent once by the board's card, never by the 3 s polls).
  if (params.get('prep') === '1') after(() => ensurePrepBeforeMeeting(cycle, s.meeting.startedAt).catch(err => console.warn('ensurePrepBeforeMeeting failed', err)))
  return NextResponse.json(s, { headers: { 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  const adminId = await getAdminId()
  if (!adminId) return new NextResponse(null, { status: 404 })

  let body: Record<string, unknown> = {}
  try { body = await request.json() } catch { /* empty body */ }
  const cycleId = typeof body.cycle_id === 'string' ? body.cycle_id : ''
  const { data: cycle } = await createAdminClient().from('cycles').select('id, label, meeting_at').eq('id', cycleId).maybeSingle()
  if (!cycle) return NextResponse.json({ error: 'No such month' }, { status: 404 })

  const fail = (error: { message: string } | null) =>
    error ? NextResponse.json({ error: /meetings/.test(error.message) ? 'Apply migration 041 first.' : error.message }, { status: 500 }) : null
  const now = new Date().toISOString()

  switch (body.action) {
    case 'save': {
      const patch: Record<string, unknown> = {}
      const meet = httpsOrNull(body.meet_url)
      const recording = httpsOrNull(body.recording_url)
      if (body.meet_url !== undefined && meet === undefined) return NextResponse.json({ error: 'The call link must be a full https:// link.' }, { status: 400 })
      if (body.recording_url !== undefined && recording === undefined) return NextResponse.json({ error: 'The recording must be a full https:// link.' }, { status: 400 })
      if (meet !== undefined) patch.meet_url = meet
      if (recording !== undefined) patch.recording_url = recording
      if (body.agenda !== undefined) patch.agenda = await mergeAgenda(cycle.id, body.agenda)
      if (typeof body.recap === 'string') patch.recap = body.recap.trim().slice(0, LIMITS.recap) || null
      const { error } = await saveMeeting(cycle.id, patch)
      return fail(error) ?? NextResponse.json({ meeting: await getMeeting(cycle.id) })
    }
    case 'draft_agenda':
      return NextResponse.json({ agenda: await draftAgenda(cycle.id, adminId) })
    case 'post_agenda': {
      const m = await getMeeting(cycle.id)
      if (!m.agenda.length) return NextResponse.json({ error: 'Save an agenda first.' }, { status: 400 })
      if (!isSlackConfigured()) return NextResponse.json({ error: 'Slack isn’t set up on the server (SLACK_BOT_TOKEN, SLACK_CHANNEL_ID).' }, { status: 400 })
      if (!(await postToSlack(agendaMessage(cycle.label, cycle.meeting_at, m)))) return NextResponse.json({ error: 'Slack didn’t take it. Try again.' }, { status: 502 })
      const { error } = await saveMeeting(cycle.id, { agenda_posted_at: now })
      // Posted means locked: Kers drafts whatever prep is still missing.
      if (!error) after(() => draftPrep(cycle.id).catch(err => console.warn('draftPrep failed', err)))
      return fail(error) ?? NextResponse.json({ meeting: await getMeeting(cycle.id) })
    }
    case 'draft_prep': {
      const m = await getMeeting(cycle.id)
      if (!m.agenda.length) return NextResponse.json({ error: 'Save an agenda first.' }, { status: 400 })
      const segment = typeof body.segment === 'string' ? body.segment : undefined
      const r = await draftPrep(cycle.id, { segmentId: segment })
      return NextResponse.json({ meeting: await getMeeting(cycle.id), drafted: r.drafted, tried: r.tried })
    }
    case 'start': {
      const m = await getMeeting(cycle.id)
      if (!m.agenda.length) return NextResponse.json({ error: 'Save an agenda first.' }, { status: 400 })
      const live = !!m.startedAt && !m.endedAt
      // Already running with someone else presenting: join them read-only.
      if (live && m.presenterId && m.presenterId !== adminId) return NextResponse.json(await state(cycle, adminId))
      const first = m.agenda[0].id
      const resume = live && m.currentSegment && m.agenda.some(s => s.id === m.currentSegment)
      const patch = {
        started_at: live ? m.startedAt : now,
        ended_at: null,
        presenter_id: adminId,
        current_segment: resume ? m.currentSegment : first,
        segment_started_at: resume ? m.segmentStartedAt ?? now : now,
      }
      let { error } = await saveMeeting(cycle.id, patch)
      // Before 045: still start the clock; the screen keeps its place locally.
      if (missing045(error)) ({ error } = await saveMeeting(cycle.id, { started_at: patch.started_at, ended_at: null }))
      if (!error) nudgeRoom(cycle.id)
      return fail(error) ?? NextResponse.json(await state(cycle, adminId))
    }
    case 'take_over': {
      const { error } = await saveMeeting(cycle.id, { presenter_id: adminId })
      if (missing045(error)) return NextResponse.json({ error: 'Apply migration 045 first.' }, { status: 500 })
      return fail(error) ?? NextResponse.json(await state(cycle, adminId))
    }
    case 'goto': {
      const m = await getMeeting(cycle.id)
      if (!m.startedAt || m.endedAt) return NextResponse.json({ error: 'Meeting mode isn’t on.' }, { status: 409 })
      if (!m.presenterReady) return NextResponse.json({ error: 'Apply migration 045 first.' }, { status: 500 })
      if (m.presenterId !== adminId) return NextResponse.json({ error: 'Someone else is presenting. Take over first.', ...(await state(cycle, adminId)) }, { status: 409 })
      if (!m.agenda.some(s => s.id === body.segment)) return NextResponse.json({ error: 'No such segment' }, { status: 400 })
      if (m.currentSegment === body.segment) return NextResponse.json(await state(cycle, adminId))
      const { error } = await saveMeeting(cycle.id, { current_segment: body.segment, segment_started_at: now })
      // Moving on closes whatever was open; phones go back to "Watch the screen".
      if (!error) {
        await closeOpenActivities(createAdminClient(), cycle.id)
        nudgeRoom(cycle.id)
      }
      return fail(error) ?? NextResponse.json(await state(cycle, adminId))
    }
    case 'end': {
      const { error } = await saveMeeting(cycle.id, { ended_at: now })
      if (!error) await closeRoom(createAdminClient(), cycle.id)
      return fail(error) ?? NextResponse.json(await state(cycle, adminId))
    }
    case 'open_activity':
    case 'close_activity': {
      const m = await getMeeting(cycle.id)
      if (!m.startedAt || m.endedAt) return NextResponse.json({ error: 'Meeting mode isn’t on.' }, { status: 409 })
      if (m.presenterId !== adminId) return NextResponse.json({ error: 'Someone else is presenting. Take over first.', ...(await state(cycle, adminId)) }, { status: 409 })
      if (body.action === 'close_activity') await closeActivity(createAdminClient(), cycle.id, body.activity_id)
      else {
        const r = await openActivity(createAdminClient(), cycle.id, body.activity_id)
        if (r.error) return NextResponse.json({ error: r.error }, { status: r.status ?? 500 })
      }
      return NextResponse.json(await state(cycle, adminId))
    }
    case 'note': {
      const note = cleanNote(body.note)
      if (!note) return NextResponse.json({ error: 'Write the note first.' }, { status: 400 })
      const m = await getMeeting(cycle.id)
      const notes = [...m.notes, { ...note, id: crypto.randomUUID(), at: now }].slice(-LIMITS.notes)
      const { error } = await saveMeeting(cycle.id, { notes })
      return fail(error) ?? NextResponse.json({ meeting: await getMeeting(cycle.id) })
    }
    case 'delete_note': {
      const m = await getMeeting(cycle.id)
      const { error } = await saveMeeting(cycle.id, { notes: m.notes.filter(n => n.id !== body.id) })
      return fail(error) ?? NextResponse.json({ meeting: await getMeeting(cycle.id) })
    }
    case 'draft_recap':
      return NextResponse.json(await draftRecap(cycle.id, cycle.label, await getMeeting(cycle.id)))
    case 'post_recap': {
      const m = await getMeeting(cycle.id)
      if (!m.recap) return NextResponse.json({ error: 'Save the recap first.' }, { status: 400 })
      if (!isSlackConfigured()) return NextResponse.json({ error: 'Slack isn’t set up on the server (SLACK_BOT_TOKEN, SLACK_CHANNEL_ID).' }, { status: 400 })
      if (!(await postToSlack(recapMessage(cycle.label, m)))) return NextResponse.json({ error: 'Slack didn’t take it. Try again.' }, { status: 502 })
      const { error } = await saveMeeting(cycle.id, { recap_posted_at: now })
      return fail(error) ?? NextResponse.json({ meeting: await getMeeting(cycle.id) })
    }
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
}
