// ROUTE: GET /api/outcomes
// AUTH: authenticated
// PURPOSE: What came out of the last finished cycle. outcome_tag/outcome_note
//          have been written by admins since day one but never read back to
//          members — ideas went in and nothing visibly came out.
// DB TABLES: cycles, topics
// RLS: server client for identity; admin client to read across all authors

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { NextResponse } from 'next/server'
import { joinedUsername } from '@/lib/utils/anonymity'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()

  // Most recent cycle that is actually over.
  const { data: cycle } = await admin
    .from('cycles')
    .select('id, label')
    .in('status', ['closed', 'frozen'])
    .order('year', { ascending: false })
    .order('month', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!cycle) return NextResponse.json({ cycle: null, outcomes: [] })

  const { data: topics, error } = await admin
    .from('topics')
    .select('id, title, outcome_tag, outcome_note, is_anonymous, user_id, users!topics_user_id_fkey(username)')
    .eq('cycle_id', cycle.id)
    .eq('is_deleted', false)
    .not('outcome_tag', 'is', null)
    .neq('outcome_tag', 'dropped')
    .order('outcome_tag', { ascending: true })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const outcomes = (topics ?? []).map(t => ({
    id: t.id,
    title: t.title,
    outcome_tag: t.outcome_tag,
    outcome_note: t.outcome_note,
    // Ghost topics stay ghosts here too.
    author_username: t.is_anonymous ? null : joinedUsername(t.users),
  }))

  return NextResponse.json({ cycle: { id: cycle.id, label: cycle.label }, outcomes })
}
