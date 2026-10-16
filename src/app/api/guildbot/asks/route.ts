// ROUTE: GET /api/guildbot/asks
// AUTH: signed-in members only (guests get 401 and a home with no door plate)
// PURPOSE: How many GuildBot asks you have left this rolling week, and when
//          the next one frees up when you have none. Drives the number on
//          GuildBot's door, genie mode (three or fewer) and the dark home.
// DB TABLES: guildbot_messages (count of your own asks)
// RLS: service role, pinned to the session's user id

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { SASS } from '@/lib/guildbot-host/voice'
import { asksFor } from '@/lib/guildbot-host/asks'

export async function GET() {
  if (!SASS) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  return NextResponse.json(await asksFor(createAdminClient(), user.id))
}
