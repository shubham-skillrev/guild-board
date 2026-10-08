// ROUTE: POST /api/admin/themes
// AUTH: admin only
// PURPOSE: Month themes.
//            { action: 'suggest', month_label, brief? } -> 3 Gemini options
//            { action: 'save', cycle_id, theme | null } -> set or clear the
//                                                         theme of an open or
//                                                         upcoming cycle
//          A new cycle takes its theme at creation (POST /api/admin/cycles),
//          so the cycle-open message carries it.
// DB TABLES: cycles, users
// RLS: server client for identity; admin client for reads and writes

import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { isGeminiConfigured } from '@/lib/ai/gemini'
import { sanitizeTheme, type CycleTheme } from '@/lib/themes'
import { suggestThemes } from '@/lib/themes/suggest'

// One Gemini call, with retries on rate limits.
export const maxDuration = 120

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const admin = createAdminClient()
  const { data: me } = await admin.from('users').select('role').eq('id', user.id).maybeSingle()
  if (me?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: Record<string, unknown> = {}
  try { body = await request.json() } catch { /* empty body */ }

  if (body.action === 'suggest') {
    const monthLabel = typeof body.month_label === 'string' ? body.month_label.trim().slice(0, 40) : ''
    if (!monthLabel) return NextResponse.json({ error: 'month_label is required' }, { status: 400 })
    if (!isGeminiConfigured()) {
      return NextResponse.json({ error: 'GEMINI_API_KEY is not set on the server.' }, { status: 400 })
    }
    const { data: recent } = await admin
      .from('cycles')
      .select('label, theme')
      .not('theme', 'is', null)
      .order('year', { ascending: false })
      .order('month', { ascending: false })
      .limit(3)
    const pastThemes = (recent ?? []).flatMap(c => {
      const theme = sanitizeTheme(c.theme)
      return theme ? [{ label: c.label as string, theme }] : []
    })
    const brief = typeof body.brief === 'string' ? body.brief.trim().slice(0, 300) : ''
    const themes = await suggestThemes({ monthLabel, pastThemes, brief: brief || undefined })
    if (themes.length === 0) {
      return NextResponse.json(
        { error: 'Gemini did not return usable themes (often a rate limit). Try again in a minute.' },
        { status: 502 },
      )
    }
    return NextResponse.json({ themes })
  }

  if (body.action === 'save') {
    const cycleId = typeof body.cycle_id === 'string' ? body.cycle_id : ''
    if (!cycleId) return NextResponse.json({ error: 'cycle_id is required' }, { status: 400 })

    let theme: CycleTheme | null = null
    if (body.theme !== null) {
      theme = sanitizeTheme(body.theme)
      if (!theme) return NextResponse.json({ error: 'Every theme field needs filling in.' }, { status: 400 })
    }

    const { data: cycle } = await admin.from('cycles').select('id, status').eq('id', cycleId).maybeSingle()
    if (!cycle) return NextResponse.json({ error: 'Cycle not found' }, { status: 404 })
    // A past month keeps the theme it ran with.
    if (cycle.status !== 'open' && cycle.status !== 'upcoming') {
      return NextResponse.json({ error: 'Only an open or upcoming cycle can change its theme.' }, { status: 400 })
    }

    const { data, error } = await admin
      .from('cycles')
      .update({ theme })
      .eq('id', cycleId)
      .select('id, label, theme')
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
