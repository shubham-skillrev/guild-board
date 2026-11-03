import 'server-only'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export interface Staff {
  userId: string
  isAdmin: boolean
  /** The team this person leads, if any (migration 040). Leads see their
   *  team's totals on /admin and nothing else there. */
  leadTeam: { id: string; name: string } | null
}

/** Who is asking, if they run the guild or lead a team. Null for everyone else. */
export async function getStaff(): Promise<Staff | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const [{ data: me }, { data: team }] = await Promise.all([
    admin.from('users').select('role').eq('id', user.id).maybeSingle(),
    admin.from('teams').select('id, name').eq('lead_id', user.id).limit(1).maybeSingle(),
  ])
  const isAdmin = me?.role === 'admin'
  if (!isAdmin && !team) return null
  return { userId: user.id, isAdmin, leadTeam: team ?? null }
}

/** The signed-in admin's id, or null. */
export async function getAdminId(): Promise<string | null> {
  const staff = await getStaff()
  return staff?.isAdmin ? staff.userId : null
}
