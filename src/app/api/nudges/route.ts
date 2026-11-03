// ROUTE: GET /api/nudges
// AUTH: members
// PURPOSE: The signed-in member's unread notes from the organisers, for the
//          card on their board. Empty for anyone with "No nudges" on.
// DB TABLES: nudges, users

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ notes: [] })

  const { data } = await createAdminClient()
    .from('nudges')
    .select('id, body, sent_at, sender:users!nudges_sent_by_fkey(username, real_name)')
    .eq('user_id', user.id)
    .in('channel', ['inbox', 'push'])
    .is('seen_at', null)
    .order('sent_at', { ascending: false })
    .limit(3)

  return NextResponse.json(
    {
      notes: (data ?? []).map(n => {
        const s = n.sender as unknown as { username: string; real_name: string | null } | null
        return { id: n.id, body: n.body, sentAt: n.sent_at, from: s ? s.real_name || `@${s.username}` : 'The guild organisers' }
      }),
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  )
}
