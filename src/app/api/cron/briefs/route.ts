// ROUTE: GET /api/cron/briefs
// AUTH: CRON_SECRET bearer (404 otherwise)
// PURPOSE: The same as the admin "Rewrite older Bytes as briefs" button, for
//          a one-off backfill from a terminal: converts the next dozen and
//          returns { converted, left }. Not on a schedule (the daily
//          autopilot already does a dozen a day).
// DB TABLES: bytes

import { NextResponse } from 'next/server'
import { rejectIfNotCron } from '@/lib/bytes/cron'
import { briefsLeft, convertOldBytes } from '@/lib/bytes/briefs'

export const maxDuration = 300

export async function GET(request: Request) {
  const rejected = rejectIfNotCron(request)
  if (rejected) return rejected
  const { converted } = await convertOldBytes()
  return NextResponse.json({ converted, left: await briefsLeft() })
}
