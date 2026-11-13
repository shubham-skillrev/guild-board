'use client'

import { useEffect, useMemo, useRef } from 'react'
import { MeetRoom, type MeetRoomOffline } from '@/components/meet/MeetRoom'
import { cleanWord, type MeetView, type PublicActivity, type RoomState } from '@/lib/meet/activity'
import type { MeetPost, PresenterNotes, PublicSegment } from '@/lib/meeting'
import { addAnswer } from '@/lib/meet/rehearse'
import { checkQuestion, type PublicQuestion } from '@/lib/meet/questions'
import { isReaction, type Reaction } from '@/lib/meet/reactions'

/** Rehearsal's extras, kept by the presenter screen: its sample questions and the reactions it floats. */
export interface PreviewExtras {
  questions: PublicQuestion[]
  shownQuestion: PublicQuestion | null
  voted: string[]
  ask: (text: string) => void
  vote: (id: string, on: boolean) => void
  react: (r: Reaction) => void
}

/**
 * Rehearsal only: what a phone in the room sees, beside the presenter
 * screen, so the admin can tap through the phone side while rehearsing.
 * It is the real /meet room (MeetRoom) offline: no network, no channel.
 * The room is the rehearsal's current activity; an answer here goes back to
 * the presenter screen (`onAnswer`) and lands on top of the sample answers.
 * It is the presenter's own phone: the segment's cards, and their notes.
 */
export function PhonePreview({
  cycleId,
  label,
  segment,
  activity,
  agenda,
  posts,
  notes,
  participants,
  mine,
  onAnswer,
  extras,
}: {
  cycleId: string
  label: string
  segment: string
  activity: PublicActivity | null
  agenda: PublicSegment[]
  posts: Record<string, MeetPost>
  notes: PresenterNotes | null
  participants: number
  /** This phone's answers so far, by activity id. */
  mine: Record<string, Record<string, unknown>[]>
  onAnswer: (activityId: string, values: Record<string, unknown>[]) => void
  extras?: PreviewExtras
}) {
  const questions = extras?.questions
  const shownQuestion = extras?.shownQuestion
  const room: RoomState = useMemo(
    () => ({ cycleId, live: true, participants, segment, activity, warm: true, at: new Date().toISOString(), ...(questions ? { questions, shownQuestion: shownQuestion ?? null } : {}) }),
    [cycleId, participants, segment, activity, questions, shownQuestion],
  )
  const extrasRef = useRef(extras)
  useEffect(() => { extrasRef.current = extras })
  const saved = useRef(mine)
  useEffect(() => { saved.current = mine })
  const kind = activity?.kind ?? 'poll'

  const initial: MeetView = {
    cycleId,
    label,
    ready: true,
    room,
    member: 'you',
    joined: { kind: 'member', name: null },
    mine: activity && mine[activity.id] ? { activityId: activity.id, values: mine[activity.id] } : null,
    agenda,
    posts,
    notes,
    voted: extras?.voted ?? [],
  }

  const offline: MeetRoomOffline = useMemo(
    () => ({
      room,
      phone: true,
      post: async (body: Record<string, unknown>) => {
        if (body.action === 'join') return { ...initial, joined: { kind: 'member', name: null } }
        // The extras, as POST /api/meet would answer them (no rate limit: it's one person rehearsing).
        if (body.action === 'react') {
          if (isReaction(body.reaction)) extrasRef.current?.react(body.reaction)
          return { ok: true, sent: true }
        }
        if (body.action === 'ask') {
          const c = checkQuestion(body.text)
          if (!c.ok) {
            if (c.blocked) return { ok: false, blocked: true, message: c.error }
            throw new Error(c.error)
          }
          extrasRef.current?.ask(c.text)
          return { ok: true }
        }
        if (body.action === 'vote') {
          const id = String(body.question_id)
          extrasRef.current?.vote(id, body.on !== false)
          const before = extrasRef.current?.voted ?? []
          return { ok: true, voted: body.on !== false ? [...before.filter(x => x !== id), id] : before.filter(x => x !== id) }
        }
        const id = String(body.activity_id)
        let value = (body.value ?? {}) as Record<string, unknown>
        if ('word' in value) {
          const w = cleanWord(value.word)
          if (!w) throw new Error('Type a word first.')
          value = { word: w }
        }
        const values = addAnswer(kind, saved.current[id] ?? [], value)
        onAnswer(id, values)
        return { ok: true, mine: { activityId: id, values } }
      },
    }),
    // `initial` is rebuilt each render; the post only needs its shape.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [room, kind, onAnswer],
  )

  return (
    <aside aria-label="Phone preview (rehearsal only)" className="fixed right-6 top-20 z-10 origin-top-right scale-[0.86]">
      <p className="eyebrow mb-2 text-center">Phone preview · M hides</p>
      <div className="rounded-[44px] border border-border-strong bg-[#16181D] p-2.5 shadow-[0_16px_40px_var(--shadow-tint-strong)]">
        <div className="h-[720px] w-[375px] overflow-y-auto rounded-[34px] bg-parchment [&>div]:min-h-full!">
          <MeetRoom key={`${activity?.id ?? 'none'}:${activity?.status ?? ''}`} initial={initial} offline={offline} />
        </div>
      </div>
    </aside>
  )
}
