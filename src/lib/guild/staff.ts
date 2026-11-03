import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface Staff {
  userId: string
  isAdmin: boolean
  /** A viewer (migration 043) sees the control room's analytics, read-only:
   *  no Run tab, no nudges, no Kers' draw, no edits. */
  readOnly: boolean
}

/** Who is asking, if they may see the control room. Null for everyone else. */
export async function getStaff(): Promise<Staff | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: me } = await createAdminClient().from('users').select('role').eq('id', user.id).maybeSingle()
  if (me?.role === 'admin') return { userId: user.id, isAdmin: true, readOnly: false }
  if (me?.role === 'viewer') return { userId: user.id, isAdmin: false, readOnly: true }
  return null
}

/** The signed-in admin's id, or null. */
export async function getAdminId(): Promise<string | null> {
  const staff = await getStaff()
  return staff?.isAdmin ? staff.userId : null
}
