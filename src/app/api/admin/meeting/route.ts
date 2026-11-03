// ROUTE: POST /api/admin/meeting  { action, cycle_id, ... }
// AUTH: admin only
// PURPOSE: Everything about the month's meeting (migration 041):
//            save          { meet_url?, agenda?, recording_url?, recap? }
//            draft_agenda  -> { agenda } built from the format (not saved)
//            post_agenda   the saved agenda to the guild's Slack channel
//            start | end   meeting mode's clock
//            note          { note: { text, owner?, decision?, segment? } }
//            delete_note   { id }
//            draft_recap   -> { recap, byAi } from what was captured (not saved)
//            post_recap    the saved recap to Slack
// DB TABLES: meetings, cycles, topics, demos, radar_links, bytes

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminId } from '@/lib/guild/staff'
import { agendaMessage, draftAgenda, draftRecap, getMeeting, recapMessage, saveMeeting } from '@/lib/guild/meeting'
import { cleanAgenda, cleanNote, LIMITS } from '@/lib/meeting'
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
      if (body.agenda !== undefined) patch.agenda = cleanAgenda(body.agenda)
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
      return fail(error) ?? NextResponse.json({ meeting: await getMeeting(cycle.id) })
    }
    case 'start':
    case 'end': {
      const { error } = await saveMeeting(cycle.id, body.action === 'start' ? { started_at: now, ended_at: null } : { ended_at: now })
      return fail(error) ?? NextResponse.json({ meeting: await getMeeting(cycle.id) })
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
