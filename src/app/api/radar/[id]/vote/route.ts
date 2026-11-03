// ROUTE: POST /api/radar/[id]/vote
// AUTH: members
// PURPOSE: Toggle your vote on a Radar link. Returns { voted }.
// DB TABLES: radar_votes (radar_links.vote_count follows by trigger)

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: link } = await admin.from('radar_links').select('id').eq('id', id).eq('is_deleted', false).maybeSingle()
  if (!link) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data: existing } = await admin.from('radar_votes').select('link_id').eq('link_id', id).eq('user_id', user.id).maybeSingle()
  if (existing) {
    await admin.from('radar_votes').delete().eq('link_id', id).eq('user_id', user.id)
    return NextResponse.json({ voted: false })
  }
  const { error } = await admin.from('radar_votes').insert({ link_id: id, user_id: user.id })
  if (error && error.code !== '23505') return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ voted: true })
}
