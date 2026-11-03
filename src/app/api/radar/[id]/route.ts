// ROUTE: DELETE /api/radar/[id]
// AUTH: the member who added the link, or an admin
// PURPOSE: Take a Radar link down (soft delete).
// DB TABLES: radar_links, users

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const [{ data: link }, { data: me }] = await Promise.all([
    admin.from('radar_links').select('user_id').eq('id', id).maybeSingle(),
    admin.from('users').select('role').eq('id', user.id).maybeSingle(),
  ])
  if (!link || (link.user_id !== user.id && me?.role !== 'admin')) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error } = await admin.from('radar_links').update({ is_deleted: true }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
