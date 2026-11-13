import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { missing046, missing051, nudgeRoom, votedBy, type Participant } from '@/lib/meet/room'
import { hiddenOf, hideWord, unhideWord } from '@/lib/meet/activity'
import { askRefusal, checkQuestion, voteChange } from '@/lib/meet/questions'
import { isReaction, reactionAllowed, reactionCount, type Reaction } from '@/lib/meet/reactions'

/**
 * Meeting mode's extras on the server (docs/08-meeting-mode-v2.md, Batch 4,
 * migration 051): live reactions, the ask-anything queue, and hiding words
 * from a word cloud. Each write nudges the room (room.ts nudgeRoom), so the
 * shared screen and every phone get it on the existing broadcast.
 *
 * Before 051 every action here answers "apply migration 051" (503) and the
 * room carries `extrasReady: false`, so the phones hide these.
 */

type Admin = ReturnType<typeof createAdminClient>
type Fail = { ok: false; status: number; error: string; blocked?: boolean }

const NOT_READY: Fail = { ok: false, status: 503, error: 'This needs migration 051 first.' }
const isId = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v)

function failed(error: { message?: string; code?: string } | null, what: string): Fail {
  if (missing051(error) || missing046(error)) return NOT_READY
  console.warn(`${what} failed`, error?.message)
  return { ok: false, status: 500, error: 'Could not do that. Try again.' }
}

// ─── Reactions ─────────────────────────────────────────────────────────────

/**
 * One 🔥 😂 👏 from a phone. Rate-limited per person (lib/meet/reactions.ts):
 * a faster tap or one past the cap is taken and dropped quietly (`sent:
 * false`). The update only lands if the row is still what was read, so two
 * taps at once count once.
 */
export async function react(admin: Admin, cycleId: string, participant: Participant, raw: unknown): Promise<{ ok: true; sent: boolean } | Fail> {
  if (!isReaction(raw)) return { ok: false, status: 400, error: 'No such reaction.' }
  const kind: Reaction = raw
  const seed = await admin.from('meeting_reactions').upsert({ participant_id: participant.id, cycle_id: cycleId }, { onConflict: 'participant_id', ignoreDuplicates: true })
  if (seed.error) return failed(seed.error, 'react')
  const { data, error } = await admin.from('meeting_reactions').select('fire, laugh, clap, last_at').eq('participant_id', participant.id).maybeSingle()
  if (error || !data) return failed(error, 'react')
  const now = Date.now()
  const last = data.last_at ? new Date(data.last_at as string).getTime() : 0
  if (!reactionAllowed(reactionCount(data), last, now)) return { ok: true, sent: false }
  let q = admin
    .from('meeting_reactions')
    .update({ [kind]: Math.max(0, Number(data[kind]) || 0) + 1, last_at: new Date(now).toISOString() })
    .eq('participant_id', participant.id)
  q = data.last_at ? q.eq('last_at', data.last_at as string) : q.is('last_at', null)
  const { data: done, error: e } = await q.select('participant_id')
  if (e) return failed(e, 'react')
  if (!done?.length) return { ok: true, sent: false }
  nudgeRoom(cycleId)
  return { ok: true, sent: true }
}

// ─── Ask anything ──────────────────────────────────────────────────────────

/** An anonymous question from a phone: cleaned, filtered (a quiet drop), rate-limited. */
export async function ask(admin: Admin, cycleId: string, participant: Participant, raw: unknown): Promise<{ ok: true } | Fail> {
  const checked = checkQuestion(raw)
  if (!checked.ok) return { ok: false, status: checked.blocked ? 200 : 400, error: checked.error, blocked: checked.blocked }
  const { data: mine, error } = await admin.from('meeting_questions').select('created_at').eq('participant_id', participant.id)
  if (error) return failed(error, 'ask')
  const refusal = askRefusal((mine ?? []).map(r => new Date(r.created_at as string).getTime()), Date.now())
  if (refusal) return { ok: false, status: 429, error: refusal }
  const { error: e } = await admin.from('meeting_questions').insert({ cycle_id: cycleId, participant_id: participant.id, body: checked.text })
  if (e) return failed(e, 'ask')
  nudgeRoom(cycleId)
  return { ok: true }
}

/** Upvote a question (`want` true) or take the vote back. One per person per question (the primary key). */
export async function vote(admin: Admin, cycleId: string, participant: Participant, questionId: unknown, want: unknown): Promise<{ ok: true; voted: string[] } | Fail> {
  if (!isId(questionId)) return { ok: false, status: 400, error: 'No such question.' }
  const { data: q, error } = await admin.from('meeting_questions').select('id, answered_at').eq('id', questionId).eq('cycle_id', cycleId).maybeSingle()
  if (error) return failed(error, 'vote')
  if (!q) return { ok: false, status: 404, error: 'No such question.' }
  const before = await votedBy(admin, participant.id)
  const change = voteChange(before.includes(questionId), want !== false, !!q.answered_at)
  if (change === 'none') return { ok: true, voted: before }
  const { error: e } =
    change === 'add'
      ? await admin.from('meeting_question_votes').upsert({ question_id: questionId, participant_id: participant.id }, { onConflict: 'question_id,participant_id', ignoreDuplicates: true })
      : await admin.from('meeting_question_votes').delete().eq('question_id', questionId).eq('participant_id', participant.id)
  if (e) return failed(e, 'vote')
  nudgeRoom(cycleId)
  return { ok: true, voted: change === 'add' ? [...before, questionId] : before.filter(id => id !== questionId) }
}

/** The presenter pulls one question onto the shared screen (`questionId` null: takes it down). */
export async function showQuestion(admin: Admin, cycleId: string, questionId: unknown): Promise<{ error: string | null; status?: number }> {
  if (questionId !== null && !isId(questionId)) return { error: 'No such question.', status: 400 }
  // One on screen at a time (a unique index too): whatever was up comes down first.
  const off = await admin.from('meeting_questions').update({ shown_at: null }).eq('cycle_id', cycleId).not('shown_at', 'is', null)
  if (off.error) return { error: missing051(off.error) ? NOT_READY.error : off.error.message, status: 500 }
  if (questionId) {
    const { error } = await admin.from('meeting_questions').update({ shown_at: new Date().toISOString() }).eq('id', questionId).eq('cycle_id', cycleId)
    if (error) return { error: error.message, status: 500 }
  }
  nudgeRoom(cycleId)
  return { error: null }
}

/** Mark a question answered (or not). Answering one that's on screen takes it down. */
export async function answerQuestion(admin: Admin, cycleId: string, questionId: unknown, answered: unknown): Promise<{ error: string | null; status?: number }> {
  if (!isId(questionId)) return { error: 'No such question.', status: 400 }
  const done = answered !== false
  const patch = done ? { answered_at: new Date().toISOString(), shown_at: null } : { answered_at: null }
  const { error } = await admin.from('meeting_questions').update(patch).eq('id', questionId).eq('cycle_id', cycleId)
  if (error) return { error: missing051(error) ? NOT_READY.error : error.message, status: 500 }
  nudgeRoom(cycleId)
  return { error: null }
}

// ─── Word cloud moderation ─────────────────────────────────────────────────

/**
 * The presenter hides a word from a word cloud (or brings it back). Stored on
 * the activity (meeting_activities.hidden_words); aggregate() drops it, so
 * the screen, the phones and the report all lose it at once.
 */
export async function setHidden(admin: Admin, cycleId: string, activityId: unknown, word: unknown, hide: boolean): Promise<{ error: string | null; status?: number; hidden?: string[] }> {
  if (!isId(activityId)) return { error: 'No such activity', status: 400 }
  const { data: a, error } = await admin.from('meeting_activities').select('*').eq('id', activityId).eq('cycle_id', cycleId).maybeSingle()
  if (error) return { error: error.message, status: 500 }
  if (!a) return { error: 'No such activity', status: 404 }
  if (a.kind !== 'cloud') return { error: 'Only a word cloud’s words can be hidden.', status: 400 }
  if (!('hidden_words' in a)) return { error: 'Apply migration 051 first (hiding words).', status: 503 }
  const hidden = hide ? hideWord(a.hidden_words, word) : unhideWord(a.hidden_words, word)
  const { error: e } = await admin.from('meeting_activities').update({ hidden_words: hidden }).eq('id', activityId)
  if (e) return { error: missing051(e) ? 'Apply migration 051 first (hiding words).' : e.message, status: 500 }
  nudgeRoom(cycleId)
  return { error: null, hidden }
}

/** A word cloud's hidden words, for the presenter's "Hidden (n)" list. Null before 051 or for any other kind. */
export async function hiddenFor(admin: Admin, cycleId: string, activityId: string): Promise<string[] | null> {
  const { data, error } = await admin.from('meeting_activities').select('*').eq('id', activityId).eq('cycle_id', cycleId).maybeSingle()
  if (error || !data || data.kind !== 'cloud' || !('hidden_words' in data)) return null
  return hiddenOf(data.hidden_words)
}
