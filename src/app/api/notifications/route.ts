// ROUTE: GET /api/notifications?limit=20&before=<iso>
// AUTH: members (guests get an empty inbox)
// PURPOSE: The signed-in member's notifications, newest first, with how many
//          are unread. Feeds the bell in the top bar and /notifications.
// DB TABLES: notifications

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ items: [], unread: 0 })

  const params = new URL(request.url).searchParams
  const limit = Math.min(100, Math.max(1, Number(params.get('limit')) || 20))
  const before = params.get('before')

  const admin = createAdminClient()
  let q = admin
    .from('notifications')
    .select('id, kind, title, body, url, read_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit)
  if (before) q = q.lt('created_at', before)

  const [{ data: items }, { count }] = await Promise.all([
    q,
    admin.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', user.id).is('read_at', null),
  ])
  return NextResponse.json({ items: items ?? [], unread: count ?? 0 }, { headers: { 'Cache-Control': 'private, no-store' } })
}
