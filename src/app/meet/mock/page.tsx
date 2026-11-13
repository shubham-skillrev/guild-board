// ROUTE: /meet/mock (dev only: 404 in production)
// PURPOSE: Meeting mode on fake data, to see and tweak its screens without a
//          login, a live meeting or a database. The real presenter screen in
//          its solo preview (sample answers, countdown rings, phone preview,
//          slide editor), on the November agenda plus the v2 Boss stages.
//          Nothing is written: see MeetMock.tsx.

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { cleanAgenda, type MeetPost, type Meeting, type MeetingState, type Segment } from '@/lib/meeting'
import { makeSlides, withActivities } from '@/lib/meet/agendaEdit'
import { MeetMock } from './MeetMock'

export const metadata: Metadata = { title: 'Meeting mock' }

type Row = { segment: string; kind: 'poll' | 'cloud' | 'boss' | 'predict' | 'fill'; prompt: string; options?: string[]; config?: Record<string, unknown> }

/** Now, outside render (lint: no impure calls in the component). */
const clock = () => Date.now()

const AUTHORS = ['ghost_f25fe6', 'all_out', 'sudo', 'GuildBot']

export default async function MeetMockPage() {
  if (process.env.NODE_ENV === 'production') notFound()
  const t = clock()
  const file = JSON.parse(await readFile(path.join(process.cwd(), 'docs/agendas/2026-11.json'), 'utf8')) as {
    cycle: string
    meetingAt: string
    agenda: unknown
    activities?: Row[]
  }

  let agenda: Segment[] = withActivities(
    cleanAgenda(file.agenda),
    (file.activities ?? []).map(a => ({ segment_id: a.segment, kind: a.kind, prompt: a.prompt, options: a.options ?? [], config: a.config ?? {} })),
  )
  // The v2 Boss Round: three stages, each with its reveal, before the wrap.
  const wrap = agenda.findIndex(s => s.kind === 'wrap')
  const boss = makeSlides('boss', agenda)
  agenda = wrap >= 0 ? [...agenda.slice(0, wrap), ...boss, ...agenda.slice(wrap)] : [...agenda, ...boss]

  // Every board post the slides mention, made up.
  const ids = new Set<string>()
  for (const s of agenda) {
    for (const id of s.topicIds ?? []) ids.add(id)
    for (const c of s.cards ?? []) if (c.kind === 'post') ids.add(c.postId)
  }
  const posts: Record<string, MeetPost> = {}
  ;[...ids].forEach((id, i) => {
    posts[id] = {
      id,
      title: `Board topic ${i + 1}`,
      description: 'A sample description, standing in for the real post. Long enough to wrap onto a second line so the layout shows how it reads.',
      category: i % 2 ? 'new_tech' : 'take',
      is_selected: true,
      status: 'open',
      author_username: AUTHORS[i % AUTHORS.length],
      is_system: AUTHORS[i % AUTHORS.length] === 'GuildBot',
      created_at: new Date(t - 3 * 86_400_000).toISOString(),
      vote_count: 4 - (i % 3),
      comment_count: i % 4,
    }
  })

  const now = new Date(t).toISOString()
  const meeting: Meeting = {
    cycleId: 'mock',
    meetUrl: null,
    agenda,
    notes: [],
    recordingUrl: null,
    recap: null,
    agendaPostedAt: null,
    recapPostedAt: null,
    startedAt: null,
    endedAt: null,
    presenterId: 'mock-admin',
    currentSegment: null,
    segmentStartedAt: null,
    presenterReady: true,
    rehearsalCode: null,
    rehearsalStartedAt: null,
    rehearsalReady: true,
    hasDraft: true,
    draftReady: true,
  }
  const initial: MeetingState = {
    cycle: { id: 'mock', label: 'Mock meeting', meeting_at: new Date(t + 3_600_000).toISOString() },
    meeting,
    me: 'mock-admin',
    presenterName: 'sudo',
    serverNow: now,
    room: null,
  }
  return <MeetMock initial={initial} posts={posts} board={Object.values(posts)} />
}
