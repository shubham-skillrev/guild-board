'use client'

import { useCallback, useEffect, useState } from 'react'
import { PresenterView } from '@/components/meet/PresenterScreen'
import type { MeetPost, MeetingState } from '@/lib/meeting'

/**
 * The mock's presenter screen: the real PresenterView in its solo preview
 * (`rehearsal` set), so it runs the same goto plan, sample answers,
 * countdown rings and phone preview as /meet/present?rehearse=1. The meeting
 * state lives here, and the slide editor's calls to /api/admin/meeting are
 * answered locally (edits stay in this tab until a reload). Nothing reaches
 * the server.
 */
export function MeetMock({ initial, posts, board }: { initial: MeetingState; posts: Record<string, MeetPost>; board: MeetPost[] }) {
  const [state, setState] = useState(initial)

  useEffect(() => {
    const real = window.fetch
    window.fetch = async (input, init) => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
      if (!url.includes('/api/admin/meeting')) return real(input, init)
      let body: Record<string, unknown> = {}
      try { body = typeof init?.body === 'string' ? JSON.parse(init.body) : {} } catch {}
      const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } })
      if (body.action === 'save_agenda') return json({ ok: true, agenda: body.agenda, savedAt: new Date().toISOString() })
      if (body.action === 'reset_agenda') return json({ ok: true, agenda: initial.meeting.agenda, meeting: { ...initial.meeting } })
      return json({ error: 'Not in the mock: this needs the real server.' }, 400)
    }
    return () => { window.fetch = real }
  }, [initial])

  const optimistic = useCallback((patch: Partial<MeetingState['meeting']>) => {
    setState(s => ({ ...s, meeting: { ...s.meeting, ...patch } }))
  }, [])
  const call = useCallback(async <T,>(): Promise<T | null> => null, [])
  const now = useCallback(() => Date.now(), [])

  return (
    <PresenterView
      state={state}
      busy={null}
      call={call}
      optimistic={optimistic}
      now={now}
      serverNow={initial.serverNow}
      posts={posts}
      rehearsal={{}}
      board={board}
    />
  )
}
