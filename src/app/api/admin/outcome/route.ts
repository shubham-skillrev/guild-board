// ROUTE: PATCH /api/admin/outcome
// AUTH: admin only
// PURPOSE: Tag a topic's post-meeting outcome
// DB TABLES: topics, users
// RLS: admin client (bypasses RLS)

import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { OUTCOME_NOTE_MAX_LENGTH } from '@/lib/constants'
import type { OutcomeTag } from '@/types'

const VALID_OUTCOME_TAGS: OutcomeTag[] = ['discussed', 'blog_born', 'project_started', 'carry_forward', 'dropped']

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: userData } = await supabase.from('users').select('role').eq('id', user.id).single()
  if (userData?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { topic_id?: string; outcome_tag?: OutcomeTag; outcome_note?: string }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid body' }, { status: 400 }) }

  const { topic_id, outcome_tag, outcome_note } = body
  if (!topic_id || !outcome_tag) return NextResponse.json({ error: 'topic_id and outcome_tag required' }, { status: 400 })

  if (!VALID_OUTCOME_TAGS.includes(outcome_tag)) {
    return NextResponse.json({ error: `outcome_tag must be one of: ${VALID_OUTCOME_TAGS.join(', ')}` }, { status: 400 })
  }
  if (outcome_note && outcome_note.length > OUTCOME_NOTE_MAX_LENGTH) {
    return NextResponse.json({ error: `outcome_note must be ${OUTCOME_NOTE_MAX_LENGTH} characters or less` }, { status: 400 })
  }

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from('topics')
    .update({ outcome_tag, outcome_note: outcome_note ?? null })
    .eq('id', topic_id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
