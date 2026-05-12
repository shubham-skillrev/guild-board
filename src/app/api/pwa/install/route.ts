// ROUTE: POST /api/pwa/install
// AUTH: optional (anonymous installs accepted)
// PURPOSE: Record PWA install lifecycle events for analytics
// DB TABLES: pwa_installs
// RLS: server client

import { createClient } from '@/lib/supabase/server'
import { type NextRequest, NextResponse } from 'next/server'

type EventName = 'prompt_dismissed' | 'app_installed'
const VALID_EVENTS: EventName[] = ['prompt_dismissed', 'app_installed']

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let body: { event?: string; platform?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { event, platform } = body
  if (!event || !VALID_EVENTS.includes(event as EventName)) {
    return NextResponse.json({ error: 'Invalid event' }, { status: 400 })
  }

  const userAgent = request.headers.get('user-agent')?.slice(0, 512) ?? null

  const { error } = await supabase
    .from('pwa_installs')
    .insert({
      user_id: user?.id ?? null,
      event,
      platform: platform?.slice(0, 64) ?? null,
      user_agent: userAgent,
    })

  if (error && error.code !== '23505') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true }, { status: 201 })
}
