// ROUTE: GET  /api/admin/bytes/briefs -> { left }
//        POST /api/admin/bytes/briefs -> turn the next dozen older bytes into
//                                         briefs now: { converted, left }
// AUTH: admin only
// DB TABLES: bytes

import { NextResponse } from 'next/server'
import { getAdminId } from '@/lib/guild/staff'
import { briefsLeft, convertOldBytes } from '@/lib/bytes/briefs'

export const maxDuration = 300

export async function GET() {
  if (!(await getAdminId())) return new NextResponse(null, { status: 404 })
  return NextResponse.json({ left: await briefsLeft() })
}

export async function POST() {
  if (!(await getAdminId())) return new NextResponse(null, { status: 404 })
  const { converted } = await convertOldBytes()
  return NextResponse.json({ converted, left: await briefsLeft() })
}
