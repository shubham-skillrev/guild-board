'use client'

import { useEffect, useMemo, useRef } from 'react'
import { MeetRoom, type MeetRoomOffline } from '@/components/meet/MeetRoom'
import { cleanWord, type MeetView, type PublicActivity, type RoomState } from '@/lib/meet/activity'
import type { MeetPost, PresenterNotes, PublicSegment } from '@/lib/meeting'
import { addAnswer } from '@/lib/meet/rehearse'

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
}) {
  const room: RoomState = useMemo(
    () => ({ cycleId, live: true, participants, segment, activity, warm: true, at: new Date().toISOString() }),
    [cycleId, participants, segment, activity],
  )
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
  }

  const offline: MeetRoomOffline = useMemo(
    () => ({
      room,
      phone: true,
      post: async (body: Record<string, unknown>) => {
        if (body.action === 'join') return { ...initial, joined: { kind: 'member', name: null } }
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
