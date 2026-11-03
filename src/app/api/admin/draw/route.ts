// ROUTE: POST /api/admin/draw
// AUTH: admin only
// PURPOSE: Kers' draw, by hand:
//            { action: 'draw' }                      draw now for the open month
//            { action: 'swap', pick_id, user_id? }   during review: someone else
//                                                    (given, or a fresh random pick)
//            { action: 'send', draw_id }             skip the review day
// DB TABLES: draws, draw_picks, demos, users, survey_responses

import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAdminId } from '@/lib/guild/staff'
import { openCycle } from '@/lib/guild/demos'
import { runMonthlyDraw, sendDrawNow, swapPick } from '@/lib/guild/draw'

export async function POST(request: Request) {
  if (!(await getAdminId())) return new NextResponse(null, { status: 404 })
  let body: Record<string, unknown> = {}
  try { body = await request.json() } catch { /* empty body */ }
  const str = (v: unknown) => (typeof v === 'string' && v ? v : undefined)

  switch (body.action) {
    case 'draw': {
      const cycle = await openCycle(createAdminClient())
      if (!cycle) return NextResponse.json({ error: 'No open month to draw for.' }, { status: 400 })
      const made = await runMonthlyDraw(cycle.id).catch(e => { throw e })
      return NextResponse.json({ made })
    }
    case 'swap': {
      const pickId = str(body.pick_id)
      if (!pickId) return NextResponse.json({ error: 'pick_id required' }, { status: 400 })
      const { error } = await swapPick(pickId, str(body.user_id))
      return error ? NextResponse.json({ error }, { status: 400 }) : NextResponse.json({ ok: true })
    }
    case 'send': {
      const drawId = str(body.draw_id)
      if (!drawId) return NextResponse.json({ error: 'draw_id required' }, { status: 400 })
      await sendDrawNow(drawId)
      return NextResponse.json({ ok: true })
    }
    default:
      return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }
}
