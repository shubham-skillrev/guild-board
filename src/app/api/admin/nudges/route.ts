// ROUTE: POST /api/admin/nudges  { items: [{ key, body }], segment? }
// AUTH: admin only
// PURPOSE: Send edited nudges. Members get a card on their board, plus a push
//          when they have notifications on. People without an account are
//          logged as a Slack draft for the admin to paste. Skips anyone with
//          "No nudges" on or nudged in the last 14 days, whoever sent it.
// DB TABLES: nudges, users, push_subscriptions, survey_responses

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminId } from '@/lib/guild/staff'
import { getPeople } from '@/lib/guild/people'
import { NUDGE_MAX } from '@/lib/people'
import { sendPushToUser } from '@/lib/push/send'

export async function POST(request: Request) {
  const adminId = await getAdminId()
  if (!adminId) return new NextResponse(null, { status: 404 })

  let body: { items?: unknown; segment?: unknown } = {}
  try { body = await request.json() } catch { /* empty body */ }
  const items = (Array.isArray(body.items) ? body.items : [])
    .map(i => i as { key?: unknown; body?: unknown })
    .filter(i => typeof i.key === 'string' && typeof i.body === 'string' && i.body.trim())
    .slice(0, 25) as { key: string; body: string }[]
  if (!items.length) return NextResponse.json({ error: 'Nothing to send.' }, { status: 400 })
  const segment = typeof body.segment === 'string' ? body.segment.slice(0, 60) : null

  const admin = createAdminClient()
  const [{ people }, { data: sender }] = await Promise.all([
    getPeople(),
    admin.from('users').select('real_name, username').eq('id', adminId).maybeSingle(),
  ])
  const from = sender?.real_name || `@${sender?.username ?? 'the guild'}`
  const byKey = new Map(people.map(p => [p.key, p]))

  const sent: string[] = []
  const skipped: { key: string; reason: string }[] = []
  for (const item of items) {
    const p = byKey.get(item.key)
    if (!p) { skipped.push({ key: item.key, reason: 'not found' }); continue }
    if (p.nudgesOff) { skipped.push({ key: item.key, reason: 'turned nudges off' }); continue }
    if (!p.canNudge) { skipped.push({ key: item.key, reason: 'nudged in the last 14 days' }); continue }

    const text = item.body.trim().slice(0, NUDGE_MAX)
    const channel = !p.member ? 'slack_copy' : p.push ? 'push' : 'inbox'
    const { error } = await admin.from('nudges').insert({
      user_id: p.userId, email: p.email, channel, body: text, segment, sent_by: adminId,
    })
    if (error) { skipped.push({ key: item.key, reason: error.message }); continue }
    if (channel === 'push' && p.userId) {
      await sendPushToUser(p.userId, { title: `A note from ${from}`, body: text, url: '/board', tag: 'guild-nudge' }).catch(() => {})
    }
    sent.push(item.key)
  }
  return NextResponse.json({ sent, skipped })
}
