// ROUTE: POST /api/admin/meeting  { action, cycle_id, ... }
//        GET  /api/admin/meeting[?cycle_id=][&prep=1]  -> MeetingState (the open month by default;
//             prep=1 also drafts missing prep when inside the 3 h before the meeting)
// AUTH: admin only (404 for everyone else)
// PURPOSE: Everything about the month's meeting (migrations 041, 045):
//            save          { meet_url?, agenda?, recording_url?, recap? }
//                          (agenda items may carry topicIds and prep)
//            draft_agenda  -> { agenda } built from the format (not saved as
//                          the agenda; kept as Kers' draft, migration 049)
//            save_agenda   { agenda } the slide editor's autosave (Preview
//                          slides): cleaned, its activity slides' rows
//                          created / updated / removed (lib/meet/agendaEdit.ts).
//                          Refused while the meeting or a live rehearsal runs
//            reset_agenda  Kers' kept draft back as the agenda (049)
//            rewrite_slide { slide } -> { suggestion } Kers' rewrite of one
//                          slide, never saved (the admin takes it or not)
//            post_agenda   the saved agenda to the guild's Slack channel; this
//                          locks it, so Kers drafts any missing prep after
//            draft_prep    { segment? } Kers' prep now: every segment still
//                          missing one, or just `segment` (over an edit too)
//            start         meeting mode on: live, and the caller presents
//                          (unless another admin already is). A live
//                          rehearsal still running is ended and wiped first
//            rehearse_start a live rehearsal (migration 047): the real
//                          pipeline, private to `/meet?r=<code>`, never
//                          live (no started_at, no banner). Refused while the
//                          meeting is live or once it has run
//            rehearse_end  ends it and wipes every participant and answer,
//                          resets the activities, presenter and slide
//                          (lib/meet/liveRehearsal.ts)
//            take_over     the caller presents from now on
//            goto          { segment } the presenter moves the shared screen
//                          to a slide: an open activity closes, and an
//                          activity slide's activity opens (if it never has)
//            end           meeting mode off: closes any open activity and
//                          expires every guest's token (in a rehearsal:
//                          rehearse_end, so it never sets ended_at). A run
//                          nobody joined or answered is undone instead
//                          (room.ts resetHollowRun), so Start comes back
//            reopen        within REOPEN_MS (1 h) of End: live again, the
//                          caller presents, every answer kept
//            open_activity { activity_id } the presenter opens the segment's
//                          poll or word cloud (closing any other)
//            close_activity { activity_id } closes it (moving on does too)
//                          (activity slides open and close their own on goto;
//                          these two are the presenter's Reopen / Close)
//            extend_activity { activity_id } the countdown's "+30s"
//                          (migration 048, lib/meet/timer.ts). Opening sets
//                          closes_at from the slide's duration_s; once it
//                          passes, the next read of the room closes it
//            hide_word / unhide_word { activity_id, word } the presenter takes
//                          a word off a word cloud (or back): screen, phones
//                          and report all drop it (migration 051)
//            show_question { question_id | null } pulls one ask-anything
//                          question onto the shared screen (null: down)
//            answer_question { question_id, answered? } marks it answered
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
import { keepDraft, resetToDraft, rewriteSlide, saveEditedAgenda, syncActivities } from '@/lib/guild/meetingEditor'
import { editLocked, LOCKED_MESSAGE } from '@/lib/meet/agendaEdit'
import { canReopen, cleanNote, LIMITS, meetingLive, type MeetingState, type Segment } from '@/lib/meeting'
import { activitiesOnGoto, closeActivity, closeRoom, endRehearsal, extendActivity, gotoLocked, nudgeRoom, openActivity, readRoom, resetHollowRun } from '@/lib/meet/room'
import { NAV_LOCKED_MESSAGE } from '@/lib/meet/slides'
import { answerQuestion, hiddenFor, setHidden, showQuestion } from '@/lib/meet/roomExtras'
import { missing047, newRehearsalCode, rehearsalBlocked, rehearsalLeft, rehearsalOn, rehearsalWipeMode } from '@/lib/meet/liveRehearsal'
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

async function state(cycle: MeetingState['cycle'], me: string, heal = false): Promise<MeetingState> {
  let meeting = await getMeeting(cycle.id)
  let [name, room] = await Promise.all([presenterName(meeting.presenterId), readRoom(createAdminClient(), cycle.id).catch(() => null)])
  // An accidental Start then End (nobody joined, nothing answered) undoes
  // itself, so Start comes back. The room's count rules out a real meeting
  // without another query.
  if (heal && meeting.startedAt && meeting.endedAt && room?.participants === 0 && (await resetHollowRun(createAdminClient(), cycle.id, meeting))) {
    meeting = await getMeeting(cycle.id)
    ;[name, room] = await Promise.all([presenterName(meeting.presenterId), readRoom(createAdminClient(), cycle.id).catch(() => null)])
  }
  // The shown word cloud's hidden words: the presenter's "Hidden (n)" (admins only, never broadcast).
  const cloud = room?.activity?.kind === 'cloud' ? room.activity.id : null
  const words = cloud ? await hiddenFor(createAdminClient(), cycle.id, cloud) : null
  return { cycle, meeting, me, presenterName: name, serverNow: new Date().toISOString(), room, hidden: cloud && words ? { activityId: cloud, words } : null }
}

export async function GET(request: Request) {
  const adminId = await getAdminId()
  if (!adminId) return new NextResponse(null, { status: 404 })
  const params = new URL(request.url).searchParams
  const id = params.get('cycle_id')
  const admin = createAdminClient()
  const cycle = id ? (await admin.from('cycles').select('id, label, meeting_at').eq('id', id).maybeSingle()).data : await openCycle(admin)
  if (!cycle) return NextResponse.json({ error: 'No such month' }, { status: 404 })
  // The open month heals an accidental Start/End (a past month is left as it is).
  const s = await state(cycle, adminId, !id)
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
      // The slides are what the live room runs on: no agenda writes while it does.
      if (body.agenda !== undefined && editLocked(await getMeeting(cycle.id))) return NextResponse.json({ error: LOCKED_MESSAGE }, { status: 409 })
      if (body.agenda !== undefined) patch.agenda = await mergeAgenda(cycle.id, body.agenda)
      if (typeof body.recap === 'string') patch.recap = body.recap.trim().slice(0, LIMITS.recap) || null
      const { error } = await saveMeeting(cycle.id, patch)
      // Its activity slides get their rows (as the editor's autosave does).
      if (!error && patch.agenda) await syncActivities(cycle.id, patch.agenda as Segment[])
      return fail(error) ?? NextResponse.json({ meeting: await getMeeting(cycle.id) })
    }
    case 'draft_agenda': {
      const agenda = await draftAgenda(cycle.id, adminId)
      // Kers drafts once: kept, so the editor's "Reset to Kers draft" can come back to it.
      after(() => keepDraft(cycle.id, agenda))
      return NextResponse.json({ agenda })
    }
    case 'save_agenda': {
      if (editLocked(await getMeeting(cycle.id))) return NextResponse.json({ error: LOCKED_MESSAGE, locked: true }, { status: 409 })
      if (!Array.isArray(body.agenda)) return NextResponse.json({ error: 'No slides sent.' }, { status: 400 })
      const r = await saveEditedAgenda(cycle.id, body.agenda)
      if (r.error) return NextResponse.json({ error: /meetings/.test(r.error) ? 'Apply migration 041 first.' : r.error }, { status: 500 })
      return NextResponse.json({ agenda: r.agenda, sync: r.sync, savedAt: new Date().toISOString() })
    }
    case 'reset_agenda': {
      if (editLocked(await getMeeting(cycle.id))) return NextResponse.json({ error: LOCKED_MESSAGE, locked: true }, { status: 409 })
      const r = await resetToDraft(cycle.id)
      if ('error' in r) return NextResponse.json({ error: r.error }, { status: r.status })
      return NextResponse.json({ agenda: r.agenda, sync: r.sync, savedAt: new Date().toISOString() })
    }
    case 'rewrite_slide': {
      const suggestion = await rewriteSlide(body.slide, cycle.label)
      if (!suggestion) return NextResponse.json({ error: 'Kers couldn’t rewrite it just now. Try again in a bit.' }, { status: 502 })
      return NextResponse.json({ suggestion })
    }
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
      let m = await getMeeting(cycle.id)
      if (!m.agenda.length) return NextResponse.json({ error: 'Save an agenda first.' }, { status: 400 })
      // The real meeting ends any rehearsal first, and wipes it (unless the real one is already on).
      if (rehearsalLeft(m)) {
        const wiped = await endRehearsal(createAdminClient(), cycle.id, rehearsalWipeMode(m, cycle.meeting_at))
        if (wiped) return NextResponse.json({ error: `Could not end the rehearsal first: ${wiped.message}` }, { status: 500 })
        m = await getMeeting(cycle.id)
      }
      // A start left running from long ago (a test nobody ended) starts afresh.
      const live = meetingLive(m)
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
      if (!error) {
        // Starting on an activity slide opens it, as arriving on one does.
        if (!resume) await activitiesOnGoto(createAdminClient(), cycle.id, m.agenda, first)
        nudgeRoom(cycle.id)
      }
      return fail(error) ?? NextResponse.json(await state(cycle, adminId))
    }
    case 'rehearse_start': {
      const m = await getMeeting(cycle.id)
      if (!m.agenda.length) return NextResponse.json({ error: 'Save an agenda first.' }, { status: 400 })
      if (m.rehearsalReady === false) return NextResponse.json({ error: 'Apply migration 047 first.' }, { status: 500 })
      const blocked = rehearsalBlocked(m, cycle.meeting_at)
      if (blocked) return NextResponse.json({ error: blocked }, { status: 409 })
      // Already running: join it (read-only if someone else presents), same code.
      if (rehearsalOn(m)) return NextResponse.json(await state(cycle, adminId))
      // A clean slate: a stale rehearsal's or a dry run's leftovers go.
      const admin = createAdminClient()
      const wiped = await endRehearsal(admin, cycle.id, 'all')
      if (wiped) return NextResponse.json({ error: missing047(wiped) ? 'Apply migration 047 first.' : wiped.message }, { status: 500 })
      const first = m.agenda[0].id
      const { error } = await saveMeeting(cycle.id, { rehearsal_code: newRehearsalCode(), rehearsal_started_at: now, presenter_id: adminId, current_segment: first, segment_started_at: now })
      if (error) {
        const msg = missing047(error) ? 'Apply migration 047 first.' : missing045(error) ? 'Apply migration 045 first.' : error.message
        return NextResponse.json({ error: msg }, { status: 500 })
      }
      await activitiesOnGoto(admin, cycle.id, m.agenda, first)
      nudgeRoom(cycle.id)
      return NextResponse.json(await state(cycle, adminId))
    }
    case 'rehearse_end': {
      const m = await getMeeting(cycle.id)
      if (!rehearsalLeft(m)) return NextResponse.json(await state(cycle, adminId))
      const wiped = await endRehearsal(createAdminClient(), cycle.id, rehearsalWipeMode(m, cycle.meeting_at))
      if (wiped) return NextResponse.json({ error: wiped.message }, { status: 500 })
      return NextResponse.json(await state(cycle, adminId))
    }
    case 'take_over': {
      const { error } = await saveMeeting(cycle.id, { presenter_id: adminId })
      if (missing045(error)) return NextResponse.json({ error: 'Apply migration 045 first.' }, { status: 500 })
      return fail(error) ?? NextResponse.json(await state(cycle, adminId))
    }
    case 'goto': {
      const m = await getMeeting(cycle.id)
      if (!meetingLive(m) && !rehearsalOn(m)) return NextResponse.json({ error: 'Meeting mode isn’t on.' }, { status: 409 })
      if (!m.presenterReady) return NextResponse.json({ error: 'Apply migration 045 first.' }, { status: 500 })
      if (m.presenterId !== adminId) return NextResponse.json({ error: 'Someone else is presenting. Take over first.', ...(await state(cycle, adminId)) }, { status: 409 })
      if (!m.agenda.some(s => s.id === body.segment)) return NextResponse.json({ error: 'No such segment' }, { status: 400 })
      if (m.currentSegment === body.segment) return NextResponse.json(await state(cycle, adminId))
      // An open activity holds its slide: Close voting first (lib/meet/slides.ts navBlocked).
      if (await gotoLocked(createAdminClient(), cycle.id, m.agenda, m.currentSegment, String(body.segment))) {
        return NextResponse.json({ error: NAV_LOCKED_MESSAGE, ...(await state(cycle, adminId)) }, { status: 409 })
      }
      const { error } = await saveMeeting(cycle.id, { current_segment: body.segment, segment_started_at: now })
      // Moving on closes whatever was open; arriving on an activity slide opens its activity.
      if (!error) {
        await activitiesOnGoto(createAdminClient(), cycle.id, m.agenda, String(body.segment))
        nudgeRoom(cycle.id)
      }
      return fail(error) ?? NextResponse.json(await state(cycle, adminId))
    }
    case 'end': {
      const m = await getMeeting(cycle.id)
      // A rehearsal's End is rehearse_end: it never sets ended_at (meetingDone would hide the meeting).
      if (!meetingLive(m) && rehearsalLeft(m)) {
        const wiped = await endRehearsal(createAdminClient(), cycle.id, rehearsalWipeMode(m, cycle.meeting_at))
        if (wiped) return NextResponse.json({ error: wiped.message }, { status: 500 })
        return NextResponse.json(await state(cycle, adminId))
      }
      const { error } = await saveMeeting(cycle.id, { ended_at: now })
      if (!error) await closeRoom(createAdminClient(), cycle.id)
      // Nobody joined, nothing answered: an accident, undone (state heals it).
      return fail(error) ?? NextResponse.json(await state(cycle, adminId, true))
    }
    case 'reopen': {
      const m = await getMeeting(cycle.id)
      if (meetingLive(m)) return NextResponse.json(await state(cycle, adminId))
      if (!canReopen(m)) return NextResponse.json({ error: 'It can only be reopened within an hour of ending.' }, { status: 409 })
      // Live again with every answer kept; the caller presents. Guests join again (End expired their tokens).
      let { error } = await saveMeeting(cycle.id, { ended_at: null, presenter_id: adminId })
      if (missing045(error)) ({ error } = await saveMeeting(cycle.id, { ended_at: null }))
      if (!error) nudgeRoom(cycle.id)
      return fail(error) ?? NextResponse.json(await state(cycle, adminId))
    }
    case 'open_activity':
    case 'extend_activity':
    case 'close_activity': {
      const m = await getMeeting(cycle.id)
      if (!meetingLive(m) && !rehearsalOn(m)) return NextResponse.json({ error: 'Meeting mode isn’t on.' }, { status: 409 })
      if (m.presenterId !== adminId) return NextResponse.json({ error: 'Someone else is presenting. Take over first.', ...(await state(cycle, adminId)) }, { status: 409 })
      if (body.action === 'close_activity') await closeActivity(createAdminClient(), cycle.id, body.activity_id)
      else {
        const r = body.action === 'extend_activity'
          ? await extendActivity(createAdminClient(), cycle.id, body.activity_id)
          : await openActivity(createAdminClient(), cycle.id, body.activity_id, m.agenda)
        if (r.error) return NextResponse.json({ error: r.error }, { status: r.status ?? 500 })
      }
      return NextResponse.json(await state(cycle, adminId))
    }
    case 'hide_word':
    case 'unhide_word':
    case 'show_question':
    case 'answer_question': {
      const m = await getMeeting(cycle.id)
      if (!meetingLive(m) && !rehearsalOn(m)) return NextResponse.json({ error: 'Meeting mode isn’t on.' }, { status: 409 })
      if (m.presenterId !== adminId) return NextResponse.json({ error: 'Someone else is presenting. Take over first.', ...(await state(cycle, adminId)) }, { status: 409 })
      const admin = createAdminClient()
      const r =
        body.action === 'show_question' ? await showQuestion(admin, cycle.id, body.question_id ?? null)
        : body.action === 'answer_question' ? await answerQuestion(admin, cycle.id, body.question_id, body.answered)
        : await setHidden(admin, cycle.id, body.activity_id, body.word, body.action === 'hide_word')
      if (r.error) return NextResponse.json({ error: r.error }, { status: r.status ?? 500 })
      return NextResponse.json(await state(cycle, adminId))
    }
    case 'note': {
      const note = cleanNote(body.note)
      if (!note) return NextResponse.json({ error: 'Write the note first.' }, { status: 400 })
      const m = await getMeeting(cycle.id)
      // Notes feed the recap: nothing from a rehearsal may.
      if (rehearsalOn(m) && !meetingLive(m)) return NextResponse.json({ error: 'A rehearsal is running. Notes are off until it ends.' }, { status: 409 })
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
