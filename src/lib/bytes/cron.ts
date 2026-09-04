import 'server-only'
import { timingSafeEqual } from 'crypto'
import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

/**
 * The bits every scheduled Bytes job needs: prove the caller is Vercel Cron,
 * and find an admin to attribute the digest to.
 *
 * Extracted when the monthly job was added. Two copies of a shared-secret
 * check is one copy too many - the day one of them is tightened, the other is
 * the way in.
 */

/** Constant-time compare so the secret cannot be recovered by timing. */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/**
 * Returns a response to send back when the caller is not the cron, or null
 * when it is. `CRON_SECRET` missing is a 500 and a loud log: it is the exact
 * failure that silently stopped the every-other-day digest for three weeks,
 * and a job that cannot authenticate must say so rather than look idle.
 */
export function rejectIfNotCron(request: Request): NextResponse | null {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('cron/bytes: CRON_SECRET is not set, refusing to run')
    return NextResponse.json({ error: 'Not configured' }, { status: 500 })
  }

  // Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
  const header = request.headers.get('authorization') ?? ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!token || !secretMatches(token, secret)) {
    // Deliberately vague: this endpoint should not confirm it exists.
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return null
}

/** Digests need a creator. Automatic runs are attributed to the oldest admin. */
export async function firstAdminId(): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await admin
    .from('users')
    .select('id')
    .eq('role', 'admin')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  return data?.id ?? null
}
